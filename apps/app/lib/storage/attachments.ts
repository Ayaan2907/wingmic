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
  if (!cachedStore) {
    const config = storageConfigFromEnv(process.env);
    // Driver selection is startup-critical in production; one log makes the
    // chosen driver (and its root/bucket) observable in deploy logs.
    const driverDetail =
      config.driver === 's3'
        ? ` bucket=${config.bucket}`
        : config.driver === 'local'
          ? ` root=${config.root}`
          : '';
    console.info(`[object-storage] driver=${config.driver}${driverDetail}`);
    cachedStore = createObjectStore(config);
  }
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
 *
 * One store GET per distinct key — identical photos (same content-addressed
 * key) fetch once. Any store error degrades that attachment to null so a
 * flaky object never fails a whole render; missing objects log loudly since
 * they are a data-integrity problem, not a transient one.
 */
export async function hydrateAttachmentBase64List(
  rows: Array<AttachmentBytesRow | null | undefined>,
): Promise<Array<string | null>> {
  const inFlightByKey = new Map<string, Promise<string | null>>();

  const hydrateOne = (row: AttachmentBytesRow): string | null | Promise<string | null> => {
    if (row.jpegBase64) return row.jpegBase64;
    const key = row.storageKey;
    if (!key) return null;
    let inFlight = inFlightByKey.get(key);
    if (!inFlight) {
      inFlight = fetchStoredAttachmentBase64(key);
      inFlightByKey.set(key, inFlight);
    }
    return inFlight;
  };

  return Promise.all(rows.map((row) => (row ? hydrateOne(row) : null)));
}

async function fetchStoredAttachmentBase64(key: string): Promise<string | null> {
  try {
    const stored = await getAttachmentStore().get(key);
    if (!stored) {
      // The UI already renders a fallback for null. Missing objects are a
      // data-integrity problem, so log loudly rather than degrade silently.
      console.error(`[storage] attachment object missing from store: ${key}`);
      return null;
    }
    return Buffer.from(stored.body).toString('base64');
  } catch (err) {
    // A thrown store error (R2/network blip, 5xx, timeout) degrades this one
    // attachment to the UI fallback instead of failing the whole render.
    console.error(`[storage] attachment hydrate failed: ${key}`, err);
    return null;
  }
}

export async function hydrateAttachmentBase64(
  row: AttachmentBytesRow,
): Promise<string | null> {
  const [hydrated] = await hydrateAttachmentBase64List([row]);
  return hydrated ?? null;
}
