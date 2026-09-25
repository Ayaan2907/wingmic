#!/usr/bin/env bun
/**
 * CLI wrapper for the base64 → object-store attachment migration.
 *
 * Usage:
 *   bun scripts/migrate-base64-attachments.ts --dry-run   # report only
 *   bun scripts/migrate-base64-attachments.ts             # real run
 *   bun scripts/migrate-base64-attachments.ts --limit=100 # batched run
 *
 * Per-row integrity is verified inside migrateBase64Attachments (decode,
 * byte_size check, put, read-back byte-compare, post-write re-read). Exits
 * nonzero if any row failed — schedule the real run only after a clean
 * dry-run.
 */
import { db } from '@wingmic/db';
import { createObjectStore, storageConfigFromEnv } from '@wingmic/storage';
import { migrateBase64Attachments } from '../apps/app/lib/storage/migrateBase64Attachments';

const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;

const store = createObjectStore(storageConfigFromEnv(process.env));
console.error(`storage driver: ${store.driver}${dryRun ? ' (dry-run)' : ''}`);

const report = await migrateBase64Attachments({
  db,
  store,
  dryRun,
  limit,
  log: (message) => console.error(message),
});

console.log(JSON.stringify(report, null, 2));
if (report.failed > 0) {
  console.error(`migration finished with ${report.failed} failed row(s)`);
  process.exit(1);
}
console.error(
  dryRun
    ? 'dry-run complete — rerun without --dry-run to apply'
    : 'migration complete',
);
