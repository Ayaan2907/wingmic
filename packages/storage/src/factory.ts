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
 * or a test fixture. Structural so this package stays dependency-free.
 */
export type ObjectStorageEnv = {
  OBJECT_STORAGE_ENDPOINT?: string;
  OBJECT_STORAGE_BUCKET?: string;
  OBJECT_STORAGE_REGION?: string;
  OBJECT_STORAGE_ACCESS_KEY_ID?: string;
  OBJECT_STORAGE_SECRET_ACCESS_KEY?: string;
  OBJECT_STORAGE_LOCAL_ROOT?: string;
};

export const DEFAULT_LOCAL_ROOT = '.object-storage';

/**
 * Env-gated driver selection. S3/R2 only when all four required credentials
 * are present; otherwise the local filesystem driver takes over silently —
 * local dev and tests without creds never touch the network and never log.
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

  return {
    driver: 'local',
    root: env.OBJECT_STORAGE_LOCAL_ROOT?.trim() || defaults.localRoot || DEFAULT_LOCAL_ROOT,
  };
}
