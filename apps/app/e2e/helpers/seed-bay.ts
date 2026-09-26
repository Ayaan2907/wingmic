/**
 * e2e seed — bay EVENTS for the /bay surface spec, written straight into the
 * zero-secret local.db the dev server reads. The curated place inventory
 * (12 places) ships via `bun run seed:bay` in packages/db — this helper adds
 * only what that seed cannot carry: events with timestamps relative to now.
 * (The committed seed's events are frozen in time; the serve-time expiry
 * filter would hide them, and the funnel needs live inventory.)
 *
 * Two live events — one running now (the funnel's score target), one tomorrow
 * — and one that ended two days ago: the expired row must never reach the map
 * while its history stays in the table (nothing silently deleted).
 *
 * Timestamps are epoch seconds — drizzle's integer({ mode: 'timestamp' })
 * contract — matching how the app's own ingest writes rows.
 *
 * Usage: bun e2e/helpers/seed-bay.ts   (idempotent: fixed ids, replace on run)
 */
import { createClient } from '@libsql/client';
import { resolve } from 'node:path';

const appDir = resolve(__dirname, '../..');
const dbUrl = process.env.TURSO_DB_URL ?? `file:${appDir}/local.db`;
const db = createClient({ url: dbUrl });

const NOW = Date.now();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (ms: number) => Math.floor(ms / 1000); // drizzle timestamp seconds

const events = [
  {
    id: 'luma:e2e-builder-night',
    external_id: 'e2e-builder-night',
    title: 'builder night (e2e)',
    venue: 'the foundry (e2e)',
    lat: 37.7629,
    lng: -122.4099,
    price: 'free',
    category: 'events',
    note: 'same room as the foundry crowd — bring something you can demo in a minute.',
    url: 'https://lu.ma/e2e-builder-night',
    starts: NOW - HOUR,
    ends: NOW + 3 * HOUR,
  },
  {
    id: 'luma:e2e-agent-hack',
    external_id: 'e2e-agent-hack',
    title: 'agent hack weekend (e2e)',
    venue: 'cascade commons (e2e)',
    lat: 37.7752,
    lng: -122.4111,
    price: '$20',
    category: 'hackathons',
    note: null as string | null,
    url: 'https://lu.ma/e2e-agent-hack',
    starts: NOW + DAY,
    ends: NOW + 2 * DAY,
  },
  {
    id: 'luma:e2e-expired-mixer',
    external_id: 'e2e-expired-mixer',
    title: 'founders mixer, past (e2e)',
    venue: 'somewhere gone',
    lat: 37.7799,
    lng: -122.4149,
    price: 'free',
    category: 'events',
    note: null as string | null,
    url: 'https://lu.ma/e2e-expired-mixer',
    starts: NOW - 3 * DAY,
    ends: NOW - 2 * DAY,
  },
] as const;

async function main() {
  for (const e of events) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO bay_events
              (id, source, external_id, title, venue, lat, lng, price, category, url, note,
               starts_at, ends_at, expires_at, first_seen_at, fetched_at)
            VALUES (?, 'luma', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        e.id,
        e.external_id,
        e.title,
        e.venue,
        e.lat,
        e.lng,
        e.price,
        e.category,
        e.url,
        e.note,
        iso(e.starts),
        iso(e.ends),
        iso(e.ends), // the contract: events die at endsAt (grace applied at the contract edge)
        iso(NOW),
        iso(NOW),
      ],
    });
  }
  console.log(`seed-bay: ${events.length} events (two live, one expired on purpose)`);
}

main().catch((err) => {
  console.error('seed-bay failed:', err);
  process.exit(1);
});
