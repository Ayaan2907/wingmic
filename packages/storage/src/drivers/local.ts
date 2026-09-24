import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import type { ObjectStore, PutObjectInput, StoredObject } from '../types';

/**
 * Filesystem driver — the silent default when no S3/R2 env creds exist.
 * Local dev keeps working with zero secrets; objects land under `root`
 * mirroring the key structure.
 */
export function createLocalObjectStore(config: { root: string }): ObjectStore {
  const root = config.root;

  function resolvePath(key: string): string {
    // Reject traversal — keys are generated internally, but stay defensive.
    const clean = normalize(key).replace(/^([.][.][/\\])+/, '');
    if (clean.startsWith('..') || key.includes('..')) {
      throw new Error(`invalid object key: ${key}`);
    }
    return join(root, clean);
  }

  return {
    driver: 'local',

    async put(input: PutObjectInput): Promise<void> {
      const target = resolvePath(input.key);
      await mkdir(dirname(target), { recursive: true });
      // Write-then-rename keeps readers from observing partial files.
      const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tmp, input.body);
      await rename(tmp, target);
    },

    async get(key: string): Promise<StoredObject | null> {
      try {
        const body = await readFile(resolvePath(key));
        return { body, contentType: 'application/octet-stream' };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
      }
    },

    async delete(key: string): Promise<void> {
      await rm(resolvePath(key), { force: true });
    },
  };
}
