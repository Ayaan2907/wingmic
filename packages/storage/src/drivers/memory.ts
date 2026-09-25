import type { ObjectStore, PutObjectInput, StoredObject } from '../types';

/**
 * In-memory driver for tests. Nothing persists — each instance starts empty.
 */
export function createMemoryObjectStore(): ObjectStore {
  const objects = new Map<string, StoredObject>();

  return {
    driver: 'memory',

    async put(input: PutObjectInput): Promise<void> {
      objects.set(input.key, {
        body: new Uint8Array(input.body),
        contentType: input.contentType,
      });
    },

    async get(key: string): Promise<StoredObject | null> {
      const found = objects.get(key);
      return found ? { ...found, body: new Uint8Array(found.body) } : null;
    },

    async delete(key: string): Promise<void> {
      objects.delete(key);
    },
  };
}
