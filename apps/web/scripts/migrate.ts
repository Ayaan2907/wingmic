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

async function main() {
  const url = process.env.TURSO_DB_URL ?? 'file:./local.db';
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const client = createClient({ url, authToken });
  const db = drizzle(client);

  console.log(`[migrate] applying migrations to ${url}`);
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log(`[migrate] done`);
  client.close();
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
