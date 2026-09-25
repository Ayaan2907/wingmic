import { createHash } from 'node:crypto';
import {
  attachmentStorageKey,
  createObjectStore,
  sha256FromAttachmentKey,
  storageConfigFromEnv,
  type ObjectStore,
} from '@wingmic/storage';

let cachedStore: ObjectStore | undefined;
let testOverride: ObjectStore | undefined;

/**
 * Test seam — pins the store for capture persistence, hydration, and the
 * base64→object-store data migration. Passing undefined restores env config.
 */
export function setAttachmentStoreForTests(store: ObjectStore | undefined): void {
  testOverride = store;
}

/**
 * Resolve the attachment store once per process. Driver selection is
 * env-gated (S3/R2 only with full credentials, silent local fallback
 * otherwise), so local dev and tests without creds never touch the network.
 */
export function getAttachmentStore(): ObjectStore {
  if (testOverride) return testOverride;
  cachedStore ??= createObjectStore(storageConfigFromEnv(process.env));
  return cachedStore;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function attachmentKeyForUser(userId: string, bytes: Uint8Array): string {
  return attachmentStorageKey({ userId, sha256Hex: sha256Hex(bytes) });
}

/**
 * Verify a content-addressed attachment: sha256(bytes) must equal the hex
 * segment of its key. Used by the data migration for row-by-row integrity.
 */
export function attachmentBytesMatchKey(key: string, bytes: Uint8Array): boolean {
  return sha256FromAttachmentKey(key) === sha256Hex(bytes);
}

export type AttachmentBytesRow = {
  jpegBase64: string | null;
  storageKey: string | null;
};

/**
 * Wire contract: capture surfaces receive base64 JPEGs regardless of how the
 * bytes are persisted. Storage-backed rows keep jpegBase64 null and hydrate
 * from the object store; legacy rows pass their inline base64 through until
 * the one-time data migration nulls it.
 */
export async function hydrateAttachmentBase64(
  row: AttachmentBytesRow,
): Promise<string | null> {
  if (row.jpegBase64) return row.jpegBase64;
  if (!row.storageKey) return null;
  const stored = await getAttachmentStore().get(row.storageKey);
  if (!stored) {
    // One broken object must not 500 a thread render; the UI already renders
    // a fallback for null. Missing objects are a data-integrity problem, so
    // log loudly rather than degrade silently.
    console.error(`[storage] attachment object missing from store: ${row.storageKey}`);
    return null;
  }
  return Buffer.from(stored.body).toString('base64');
}
