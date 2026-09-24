/**
 * e2e seed — an ongoing calendar event for a user, written through the same
 * fallback path production uses: settings.calendarIcsUrl set to a
 * syntactically valid google-ics URL that 404s, plus the ics_snapshot DB row
 * that getIcsSnapshot serves when the live fetch fails (R §3 — flaky venue
 * wifi is exactly when event binding matters).
 *
 * The real HTTP ICS feed cannot be stubbed from the browser (the server-side
 * fetch is unreachable to page.route), and parseCalendarIcsUrl only accepts
 * calendar.google.com hosts — so the DB fallback row IS the seeded ICS
 * fixture. Window matching, session shaping, and binding all run on real
 * production code paths.
 *
 * Each scenario passes a distinct calendar URL: the server's per-user
 * snapshot cache validates against the URL, so a new URL forces a live fetch
 * (which fails) and a fresh read of the seeded row.
 *
 * Usage: bun e2e/helpers/seed-ics.ts --email=<email> --url=<ics-url> \
 *          --events='[{"summary":"nexa summit","startMin":-60,"endMin":120}]'
 * Offsets are minutes from now (negative = past). Empty array = zero matches.
 */
import { createClient } from '@libsql/client';
import { resolve } from 'node:path';

function arg(name: string): string {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!found) throw new Error(`missing --${name} argument`);
  return found.slice(name.length + 3);
}

type SeedEvent = { summary: string; startMin: number; endMin: number };

// Same resolution as the dev server: relative default from lib/config/env,
// evaluated against the app dir (the playwright webServer's cwd).
const appDir = resolve(__dirname, '../..');
const dbUrl = process.env.TURSO_DB_URL ?? `file:${appDir}/local.db`;
const db = createClient({ url: dbUrl });

const email = arg('email');
const icsUrl = arg('url');
const seedEvents: SeedEvent[] = JSON.parse(arg('events'));

const now = Date.now();
const payload = seedEvents.map((event) => ({
  summary: event.summary,
  location: null,
  url: null,
  dateRangeStart: new Date(now + event.startMin * 60_000).toISOString(),
  dateRangeEnd: new Date(now + event.endMin * 60_000).toISOString(),
  allDay: false,
}));

const user = await db.execute({
  sql: 'SELECT id FROM user WHERE email = ?',
  args: [email],
});
const userId = user.rows[0]?.id;
if (typeof userId !== 'string') {
  throw new Error(`no user row for ${email} — sign in before seeding`);
}

const settings = await db.execute({
  sql: 'UPDATE user SET calendar_ics_url = ? WHERE id = ?',
  args: [icsUrl, userId],
});
if (settings.rowsAffected !== 1) throw new Error(`settings update failed for ${email}`);

await db.execute({
  sql: `INSERT INTO ics_snapshot (owner_user_id, payload, fetched_at)
        VALUES (?, ?, ?)
        ON CONFLICT(owner_user_id) DO UPDATE
        SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
  args: [userId, JSON.stringify(payload), Math.floor(now / 1000)],
});

console.log(`seeded ${payload.length} event(s) for ${email} at ${dbUrl}`);
