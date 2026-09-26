// The bay ingest job: one run, every source, straight into Turso through
// Drizzle. Replaces the flat-file store + in-process refresh timer the old
// repo needed (a Railway cron service couldn't write the web service's files —
// here the store is shared, so a scheduled run just writes).
//
// Sources run through the shared normalize → merge pipeline in packages/bay;
// results land via the same seed write path the predeploy uses. Per-source
// error isolation: a down source contributes nothing, never fails the run.
// Exit code: non-zero ONLY when every attempted source failed (so a cron can
// alert) — partial success and all-skipped exits are 0.
//
// Usage:
//   bun run bay:ingest              # full run against TURSO_DB_URL (remote turso url or an absolute file: url — a
//                                     relative file:./ url is refused: it would resolve against the process cwd)
//   bun run bay:ingest --dry-run    # fetch + normalize + report, no db connection at all
//   bun run bay:ingest --only=seed  # run a single source (also: luma, meetup, feeds, submissions, eventbrite)
//
// Idempotent: re-runs create nothing (stable ids land on the same row); live
// records refresh their fetchedAt provenance; the earliest firstSeenAt and any
// expired history survive.
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { fileURLToPath } from 'node:url';
// TODO(#12): hoist env to @wingmic/env so packages/db doesn't reach into apps/app
import { env } from '../../../apps/app/lib/config/env';
import { baySources, ingestExitCode, type IngestSourceResult } from '@wingmic/bay';
import { applyBayRecords } from '../src/bay/ingest-store';
import * as schema from '../src/schema';

const FETCH_TIMEOUT_MS = 15_000;

const redactDbUrl = (url: string): string => {
  // libsql urls may carry ?authToken=… — the summary line goes to cron logs,
  // so credentials in the query string must not survive it
  const q = url.indexOf('?');
  return q === -1 ? url : `${url.slice(0, q)}?<redacted>`;
};

function summaryLine(
  event: 'ingest.run' | 'ingest.dry-run',
  ranAt: string,
  db: string,
  sources: IngestSourceResult[],
  applied: {
    events: { created: number; updated: number };
    places: { created: number; updated: number };
    rejected: string[];
  } | null,
): string {
  return JSON.stringify({
    event,
    ranAt,
    db: redactDbUrl(db),
    sources: sources.map((r) => ({
      name: r.name,
      ok: r.records.length,
      errors: r.errors.length,
      ...(r.skipped ? { skipped: r.skipped } : {}),
      ...(r.errors.length > 0 ? { errorLines: r.errors.slice(0, 5) } : {}),
    })),
    ...(applied
      ? {
          applied: {
            events: applied.events,
            places: applied.places,
            rejected: applied.rejected.length,
            rejectedLines: applied.rejected.slice(0, 5),
          },
        }
      : {}),
  });
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const only = args.find((a) => a.startsWith('--only='))?.slice('--only='.length) ?? null;

  const cities = env.LUMA_CITIES
    ? env.LUMA_CITIES.split(',').map((c) => c.trim()).filter(Boolean)
    : undefined;
  const meetup =
    env.MEETUP_CLIENT_ID && env.MEETUP_CLIENT_SECRET
      ? {
          clientId: env.MEETUP_CLIENT_ID,
          clientSecret: env.MEETUP_CLIENT_SECRET,
          accessToken: env.MEETUP_ACCESS_TOKEN ?? null,
        }
      : null;

  // --only is operator-facing: a typo'd name must fail loudly, not run "nothing"
  const available = baySources({ cities, meetup });
  if (only && !available.some((s) => s.name === only)) {
    console.error(`[bay-ingest] unknown source "${only}" — available: ${available.map((s) => s.name).join(', ')}`);
    process.exit(2);
  }
  const selected = available.filter((s) => !only || s.name === only);

  const now = new Date().toISOString();

  if (dryRun) {
    // no db connection at all — fetch + normalize + report is the whole job
    const results: IngestSourceResult[] = [];
    for (const source of selected) {
      try {
        results.push(await source.fetch({ now, fetchImpl: fetch, fetchTimeoutMs: FETCH_TIMEOUT_MS }));
      } catch (e) {
        results.push({ name: source.name, records: [], errors: [String(e)] });
      }
    }
    console.log(summaryLine('ingest.dry-run', now, '(none — dry run)', results, null));
    process.exit(ingestExitCode(results));
  }

  // A silent wrong-destination write is the one failure this job must never
  // have: the env default is a cwd-relative local file, so a cron service that
  // never got the web service's TURSO_DB_URL would nightly "succeed" into an
  // ephemeral ./local.db — the bay never updates and no alert fires. Fail fast.
  const dbUrl = env.TURSO_DB_URL;
  // any file: url that is not absolute (file:/…) resolves against the process
  // cwd — file:./x, file:x and file:../x are all the same trap
  if (!dbUrl || (dbUrl.startsWith('file:') && !dbUrl.startsWith('file:/'))) {
    console.error(
      `ingest.refused: TURSO_DB_URL must be a remote libsql/turso url or an absolute file: url — got ${dbUrl ? JSON.stringify(dbUrl) : '(unset)'}. The default file:./local.db resolves against the process cwd, so a cron service without the web service's env would silently write an ephemeral local file. Set TURSO_DB_URL on the cron service (docs/deploy.md § bay event ingestion).`,
    );
    process.exit(2);
  }

  const client = createClient({ url: env.TURSO_DB_URL, authToken: env.TURSO_AUTH_TOKEN });
  const db = drizzle(client, { schema });
  // schema bootstrap is not data: a fresh local db needs its tables to exist to
  // merge against, and migrate() is a no-op when everything is applied
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });

  const results: IngestSourceResult[] = [];
  for (const source of selected) {
    try {
      results.push(await source.fetch({ now, fetchImpl: fetch, fetchTimeoutMs: FETCH_TIMEOUT_MS }));
    } catch (e) {
      results.push({ name: source.name, records: [], errors: [String(e)] });
    }
  }

  const applied = await applyBayRecords(db, results.flatMap((r) => r.records));
  console.log(summaryLine('ingest.run', now, env.TURSO_DB_URL, results, applied));
  client.close();
  process.exit(ingestExitCode(results));
}

main().catch((err) => {
  console.error('[bay-ingest] failed:', err);
  process.exit(1);
});
