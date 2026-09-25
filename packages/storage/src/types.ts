/**
 * Minimal object-storage interface shared by every driver.
 *
 * Keys are content-addressed for attachments (see keys.ts), which makes
 * `put` idempotent and lets callers verify integrity by re-hashing bytes.
 */
export type StoredObject = {
  body: Uint8Array;
  contentType?: string;
};

export type PutObjectInput = {
  key: string;
  body: Uint8Array;
  contentType: string;
};

export interface ObjectStore {
  readonly driver: 's3' | 'local' | 'memory';
  put(input: PutObjectInput): Promise<void>;
  /** Returns null when the object does not exist. */
  get(key: string): Promise<StoredObject | null>;
  /** Idempotent: deleting a missing key is not an error. */
  delete(key: string): Promise<void>;
}
