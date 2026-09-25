// Seed the Bay layer (places + bay_events) from the lifted ayaan-site content.
//
// Idempotent: re-running lands on the same stable ids, updates content in
// place, and the earliest firstSeenAt survives — a second run inserts nothing.
// Applies pending migrations first, so a fresh local db can be brought up with
// this one command. Zero-secret boot holds: with no env set, TURSO_DB_URL
// defaults to ./local.db (same gotcha as db:apply — see AGENTS.md).
//
// Usage: bun run seed:bay   (or `bun run db:seed:bay` at the repo root)
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { fileURLToPath } from 'node:url';
// TODO(#12): hoist env to @wingmic/env so packages/db doesn't reach into apps/app
import { env } from '../../../apps/app/lib/config/env';
import { loadBaySeedDir, seedBay } from '../src/bay/seed';
import * as schema from '../src/schema';

async function main() {
  const seedDir = fileURLToPath(new URL('../seed/bay', import.meta.url));
  const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
  const data = loadBaySeedDir(seedDir);

  const client = createClient({
    url: env.TURSO_DB_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
  const db = drizzle(client, { schema });

  await migrate(db, { migrationsFolder });
  const result = await seedBay(db, data);
  // one summary line, ingest.run convention — cron alerting can grep it
  console.log(
    `[seed-bay] seed.bay.run places=${JSON.stringify(result.places)} events=${JSON.stringify(result.events)} db=${env.TURSO_DB_URL}`,
  );
  client.close();
}

main().catch((err) => {
  console.error('[seed-bay] failed:', err);
  process.exit(1);
});
