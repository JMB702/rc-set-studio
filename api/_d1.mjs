// The Worker in worker/ was written against Cloudflare D1. On Vercel the same SQLite schema lives in Turso (libSQL),
// and this file gives the Worker the slice of the D1 API it uses: prepare().bind().first()/all()/run() and batch().
// Files in api/ starting with "_" are helpers, not routes.
import {createClient} from '@libsql/client';
import {readdirSync, readFileSync} from 'node:fs';

const rows = rs => rs.rows.map(r => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])));
const meta = rs => ({changes: rs.rowsAffected, last_row_id: Number(rs.lastInsertRowid ?? 0)});

class Statement {
  constructor(client, sql, args = []) {this.client = client;this.sql = sql;this.args = args;}
  bind(...args) {return new Statement(this.client, this.sql, args.map(v => v === undefined ? null : v));}
  query() {return {sql: this.sql, args: this.args};}
  async first(column) {const row = rows(await this.client.execute(this.query()))[0] ?? null;return column && row ? row[column] : row;}
  async all() {const rs = await this.client.execute(this.query());return {results: rows(rs), success: true, meta: meta(rs)};}
  async run() {const rs = await this.client.execute(this.query());return {results: [], success: true, meta: meta(rs)};}
}

export function d1(client) {
  return {
    prepare: sql => new Statement(client, sql),
    // D1 batches are one transaction; so is a libSQL "write" batch.
    batch: async statements => (await client.batch(statements.map(s => s.query()), 'write')).map(rs => ({results: rows(rs), success: true, meta: meta(rs)})),
  };
}

// Applies drizzle/*.sql in order, tracked in the same d1_migrations table wrangler uses.
export async function migrate(client, dir = new URL('../drizzle/', import.meta.url)) {
  await client.execute('CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)');
  const applied = new Set((await client.execute('SELECT name FROM d1_migrations')).rows.map(r => r.name));
  const pending = readdirSync(dir).filter(f => f.endsWith('.sql') && !applied.has(f)).sort();
  for (const name of pending) {
    const statements = readFileSync(new URL(name, dir), 'utf8').split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
    await client.batch([...statements, {sql: 'INSERT INTO d1_migrations (name) VALUES (?)', args: [name]}], 'write');
  }
  return pending;
}

export function connect(env = process.env) {
  const url = env.TURSO_DATABASE_URL;
  if (url) return createClient({url, authToken: env.TURSO_AUTH_TOKEN});
  // Production must never fall back to a throwaway database.
  if (env.VERCEL_ENV === 'production') throw Error('TURSO_DATABASE_URL is not set');
  return null;
}

let pending;
// One database per function instance. Previews without their own Turso database get a migrated in-memory one,
// so they work end to end but never read or write production records.
export function database(env = process.env) {
  return pending ??= (async () => {
    const remote = connect(env);
    if (remote) return d1(remote);
    const memory = createClient({url: ':memory:'});
    await migrate(memory);
    return d1(memory);
  })().catch(error => {pending = undefined;throw error;});
}
