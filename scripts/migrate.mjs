// Applies pending drizzle/ migrations to the Turso database named by TURSO_DATABASE_URL.
// Vercel runs this during production builds (`npm run build:vercel`); preview builds skip it.
// Run by hand with: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/migrate.mjs
import {connect, migrate} from '../api/_d1.mjs';

if (process.env.VERCEL && process.env.VERCEL_ENV !== 'production') {
  console.log('Preview build: skipping database migrations.');
} else {
  const client = connect();
  if (!client) throw Error('Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN) to migrate.');
  const applied = await migrate(client);
  console.log(applied.length ? `Applied ${applied.join(', ')}` : 'Database schema is up to date.');
  client.close();
}
