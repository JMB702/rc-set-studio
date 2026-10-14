import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createClient} from '@libsql/client';
import {connect, d1, migrate} from '../api/_d1.mjs';

// The Vercel function runs the built Worker bundle, so build it first (as `npm run build:vercel` does).
assert.equal(spawnSync(process.execPath, ['scripts/build.mjs'], {cwd: new URL('..', import.meta.url)}).status, 0, 'build failed');
delete process.env.TURSO_DATABASE_URL;delete process.env.VERCEL_ENV;
const {default: fn} = await import('../api/index.mjs');
const origin = 'https://rc.example';
const call = (path, method = 'GET', body, headers = {}) => fn.fetch(new Request(origin + path, {method, headers: {...(body ? {'Content-Type': 'application/json', Origin: origin} : {}), ...headers}, body: body ? JSON.stringify(body) : undefined}));
const shot = {version: 1, position: [-3, 2.2, 4.4], target: [0.3, 1.6, 1], mm: 85, ratio: '16:9'};

test('Migrations apply every drizzle file once and record them like wrangler', async () => {
  const client = createClient({url: ':memory:'});
  const first = await migrate(client);
  assert.ok(first.length >= 10 && first[0].startsWith('0000_'));
  assert.deepEqual(await migrate(client), []);
  const tables = (await client.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.map(r => r.name);
  for (const t of ['comments', 'camera_positions', 'lighting_setups', 'design_approvals', 'project_documents', 'project_access', 'project_receipts', 'd1_migrations']) assert.ok(tables.includes(t), t);
});

test('Comments save and read back through the function, and retries are idempotent', async () => {
  const comment = {id: crypto.randomUUID(), name: 'Jeff', body: 'Check the jack spacing', elementId: null, elementLabel: null, context: {height: 120, angle: 90, floor: 'charcoal', mode: 'finished', step: 0}};
  assert.equal((await call('/api/comments', 'POST', comment)).status, 201);
  assert.equal((await call('/api/comments', 'POST', comment)).status, 201);
  const list = await (await call('/api/comments')).json();
  assert.deepEqual(list.comments.filter(c => c.id === comment.id).map(c => c.body), ['Check the jack spacing']);
});

test('Optimistic revisions still reject stale saves (D1 meta.changes)', async () => {
  const id = crypto.randomUUID();
  const created = await (await call('/api/camera-positions', 'POST', {id, name: 'Wide', shot})).json();
  assert.equal(created.position.revision, 0);
  assert.equal((await call('/api/camera-positions', 'PATCH', {id, name: 'Wide 2', shot, revision: 0})).status, 200);
  assert.equal((await call('/api/camera-positions', 'PATCH', {id, name: 'Wide 3', shot, revision: 0})).status, 409);
});

test('The project PIN guards finance through the function', async () => {
  assert.equal((await call('/api/project/finance')).status, 401);
  const unlocked = await call('/api/project/access', 'POST', {action: 'setup', pin: '2580'});
  assert.equal(unlocked.status, 200);
  const cookie = unlocked.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('/api/project/finance', 'GET', undefined, {Cookie: cookie})).status, 200);
  assert.equal((await call('/api/project/tracking')).status, 200);
  assert.equal((await call('/api/project/access', 'POST', {action: 'unlock', pin: '0000'})).status, 401);
});

test('Batches are one transaction, like D1', async () => {
  const client = createClient({url: ':memory:'});await migrate(client);const db = d1(client);
  const insert = id => db.prepare('INSERT INTO project_documents (id,content,updated_at) VALUES (?,?,?)').bind(id, '{}', 1);
  await assert.rejects(db.batch([insert('a'), insert('a')]));
  assert.equal(await db.prepare('SELECT count(*) AS n FROM project_documents').first('n'), 0);
  const run = await insert('b').run();assert.equal(run.meta.changes, 1);
  assert.equal((await db.prepare('INSERT INTO project_documents (id,content,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING').bind('b', '{}', 1).run()).meta.changes, 0);
  assert.equal(await db.prepare('SELECT id FROM project_documents WHERE id=?').bind('missing').first(), null);
});

test('Production refuses to run without its Turso database', () => {
  assert.throws(() => connect({VERCEL_ENV: 'production'}), /TURSO_DATABASE_URL/);
  assert.equal(connect({VERCEL_ENV: 'preview'}), null);
});

test('Static assets are left to the CDN on Vercel builds', async () => {
  assert.equal(spawnSync(process.execPath, ['scripts/build.mjs'], {cwd: new URL('..', import.meta.url), env: {...process.env, VERCEL: '1'}}).status, 0);
  const {readFileSync} = await import('node:fs');
  assert.match(readFileSync(new URL('../dist/server/index.js', import.meta.url), 'utf8'), /^const AGENT_ENGINE_REVISION=.*\nconst assets=\{\};/);
  assert.equal(spawnSync(process.execPath, ['scripts/build.mjs'], {cwd: new URL('..', import.meta.url)}).status, 0);
});
