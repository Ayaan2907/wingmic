/**
 * One-time data migration: move interaction_attachment rows from inline
 * base64 to the object store.
 *
 * Per row (row-by-row verified integrity):
 *   1. decode base64 → bytes, rejecting non-canonical payloads and rows
 *      whose decoded size disagrees with the stored byte_size
 *   2. put to the store under the content-addressed key (sha256 of bytes)
 *   3. read back and byte-compare against the source
 *   4. clear jpeg_base64 and set storage_key, then re-read the row and
 *      verify the write landed
 *
 * A row that fails any step is left untouched and reported; other rows
 * still migrate. The function is idempotent — migrated rows have a null
 * jpeg_base64 and drop out of the scan on the next run.
 */
import { and, eq, isNotNull } from 'drizzle-orm';
import type { DB } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';
import { attachmentStorageKey, type ObjectStore } from '@wingmic/storage';
import { attachmentBytesMatchKey, sha256Hex } from './attachments';

export type MigrationReport = {
  scanned: number;
  migrated: number;
  failed: number;
  failures: Array<{ id: string; reason: string }>;
  /** Rows still holding inline base64 after the run (equals `failed` unless dry-run). */
  remainingBase64Rows: number | null;
};

export async function migrateBase64Attachments(args: {
  db: DB;
  store: ObjectStore;
  dryRun?: boolean;
  limit?: number;
  log?: (message: string) => void;
}): Promise<MigrationReport> {
  const log = args.log ?? (() => {});
  const rows = await args.db
    .select({
      id: schema.interactionAttachments.id,
      jpegBase64: schema.interactionAttachments.jpegBase64,
      storageKey: schema.interactionAttachments.storageKey,
      mimeType: schema.interactionAttachments.mimeType,
      byteSize: schema.interactionAttachments.byteSize,
      userId: schema.interactions.userId,
    })
    .from(schema.interactionAttachments)
    .innerJoin(
      schema.interactions,
      // Join on the owning interaction — its user_id scopes the storage key.
      eq(schema.interactionAttachments.interactionId, schema.interactions.id),
    )
    .where(isNotNull(schema.interactionAttachments.jpegBase64))
    .limit(args.limit ?? 1_000_000);

  const report: MigrationReport = {
    scanned: rows.length,
    migrated: 0,
    failed: 0,
    failures: [],
    remainingBase64Rows: null,
  };

  for (const row of rows) {
    try {
      const base64 = row.jpegBase64;
      if (!base64) {
        // Filtered out by the scan; nothing to do.
        continue;
      }
      const bytes = Buffer.from(base64, 'base64');
      if (bytes.toString('base64') !== base64) {
        throw new Error('payload is not canonical base64');
      }
      if (bytes.byteLength !== row.byteSize) {
        throw new Error(
          `byte_size mismatch: row says ${row.byteSize}, decoded ${bytes.byteLength}`,
        );
      }

      const key = attachmentStorageKey({
        userId: row.userId,
        sha256Hex: sha256Hex(bytes),
      });
      await args.store.put({
        key,
        body: bytes,
        contentType: row.mimeType || 'image/jpeg',
      });

      // Read back and byte-compare before touching the row.
      const stored = await args.store.get(key);
      if (!stored || Buffer.compare(Buffer.from(stored.body), bytes) !== 0) {
        throw new Error('read-back verification failed for ' + key);
      }
      if (!attachmentBytesMatchKey(key, bytes)) {
        throw new Error('key/content hash mismatch for ' + key);
      }

      if (args.dryRun) {
        log(`[dry-run] would migrate ${row.id} → ${key}`);
        continue;
      }

      await args.db
        .update(schema.interactionAttachments)
        .set({ storageKey: key, jpegBase64: null })
        .where(
          and(
            eq(schema.interactionAttachments.id, row.id),
            // Guard against a concurrent runner clearing base64 first.
            isNotNull(schema.interactionAttachments.jpegBase64),
          ),
        );

      const after = await args.db.query.interactionAttachments.findFirst({
        where: eq(schema.interactionAttachments.id, row.id),
        columns: { jpegBase64: true, storageKey: true },
      });
      if (!after || after.jpegBase64 !== null || after.storageKey !== key) {
        throw new Error('post-write verification failed for ' + row.id);
      }
      report.migrated += 1;
      log(`migrated ${row.id} → ${key}`);
    } catch (err) {
      report.failed += 1;
      report.failures.push({
        id: row.id,
        reason: err instanceof Error ? err.message : String(err),
      });
      log(`FAILED ${row.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!args.dryRun) {
    const remaining = await args.db
      .select({ id: schema.interactionAttachments.id })
      .from(schema.interactionAttachments)
      .where(isNotNull(schema.interactionAttachments.jpegBase64));
    report.remainingBase64Rows = remaining.length;
  }
  return report;
}
