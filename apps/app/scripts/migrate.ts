/**
 * Apply Drizzle-generated migrations to the configured libSQL database.
 *
 * Local dev (no env): writes to ./local.db
 * Production:         writes to TURSO_DB_URL with TURSO_AUTH_TOKEN
 *
 * Usage:
 *   bun run apps/web/scripts/migrate.ts
 *   or via package.json: bun run db:apply
 */
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { drizzle } from 'drizzle-orm/libsql';
import { env } from '../lib/config/env';

async function main() {
  const client = createClient({
    url: env.TURSO_DB_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
  const db = drizzle(client);

  console.log(`[migrate] applying migrations to ${env.TURSO_DB_URL}`);
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log(`[migrate] done`);
  client.close();
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
