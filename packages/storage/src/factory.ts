import type { ObjectStore } from './types';
import { createLocalObjectStore } from './drivers/local';
import { createMemoryObjectStore } from './drivers/memory';
import { createS3ObjectStore, type S3ObjectStoreConfig } from './drivers/s3';

export type ObjectStorageConfig =
  | ({ driver: 's3' } & S3ObjectStoreConfig)
  | { driver: 'local'; root: string }
  | { driver: 'memory' };

export function createObjectStore(config: ObjectStorageConfig): ObjectStore {
  switch (config.driver) {
    case 's3':
      return createS3ObjectStore(config);
    case 'local':
      return createLocalObjectStore(config);
    case 'memory':
      return createMemoryObjectStore();
  }
}

/**
 * Environment-shaped input — accepts `process.env`, apps/app's parsed env,
 * or a test fixture. A string-index Record so host environments like
 * `process.env` (whose index signature has no named keys) assign cleanly.
 */
export type ObjectStorageEnv = Record<string, string | undefined>;

export const DEFAULT_LOCAL_ROOT = '.object-storage';

/**
 * Env-gated driver selection. S3/R2 only when all four required credentials
 * are present. Otherwise: local filesystem driver in non-production — local
 * dev and tests without creds never touch the network and never log — and a
 * startup failure in production, where silently writing attachments to
 * ephemeral disk would lose bytes on redeploy and split multi-instance state.
 */
export function storageConfigFromEnv(
  env: ObjectStorageEnv,
  defaults: { localRoot?: string } = {},
): ObjectStorageConfig {
  const bucket = env.OBJECT_STORAGE_BUCKET?.trim();
  const endpoint = env.OBJECT_STORAGE_ENDPOINT?.trim();
  const accessKeyId = env.OBJECT_STORAGE_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.OBJECT_STORAGE_SECRET_ACCESS_KEY?.trim();

  if (bucket && endpoint && accessKeyId && secretAccessKey) {
    return {
      driver: 's3',
      bucket,
      endpoint,
      region: env.OBJECT_STORAGE_REGION?.trim() || 'auto',
      accessKeyId,
      secretAccessKey,
    };
  }

  if (env.NODE_ENV === 'production') {
    throw new Error(
      '[object-storage] OBJECT_STORAGE_* credentials are incomplete in production ' +
        '(need OBJECT_STORAGE_BUCKET, OBJECT_STORAGE_ENDPOINT, ' +
        'OBJECT_STORAGE_ACCESS_KEY_ID, OBJECT_STORAGE_SECRET_ACCESS_KEY). ' +
        'The local-disk fallback is disabled in production so a partial config ' +
        'fails startup instead of silently storing attachments on ephemeral disk.',
    );
  }

  return {
    driver: 'local',
    root: env.OBJECT_STORAGE_LOCAL_ROOT?.trim() || defaults.localRoot || DEFAULT_LOCAL_ROOT,
  };
}
