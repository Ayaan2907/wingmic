import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import {
  attachmentStorageKey,
  sha256FromAttachmentKey,
  createObjectStore,
  storageConfigFromEnv,
  createMemoryObjectStore,
  createLocalObjectStore,
  createS3ObjectStore,
  type ObjectStore,
  type S3ObjectStoreClient,
} from './index';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';

describe('attachmentStorageKey', () => {
  const hash = createHash('sha256').update('hello').digest('hex');

  it('builds a versioned, content-addressed path', () => {
    const key = attachmentStorageKey({ userId: 'user_1', sha256Hex: hash });
    expect(key).toBe(`attachments/v1/user_1/${hash}.jpg`);
  });

  it('round-trips the digest through sha256FromAttachmentKey', () => {
    const key = attachmentStorageKey({ userId: 'user_1', sha256Hex: hash });
    expect(sha256FromAttachmentKey(key)).toBe(hash);
  });

  it('rejects non-sha digests and empty user ids', () => {
    expect(() => attachmentStorageKey({ userId: 'u', sha256Hex: 'abc' })).toThrow();
    expect(() => attachmentStorageKey({ userId: '   ', sha256Hex: hash })).toThrow();
  });

  it('sanitizes path-hostile user ids', () => {
    const key = attachmentStorageKey({ userId: '../etc/passwd', sha256Hex: hash });
    expect(key).toBe('attachments/v1/etcpasswd/' + hash + '.jpg');
  });
});

describe('local + memory drivers', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'wingmic-storage-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const cases: Array<[string, () => ObjectStore]> = [
    ['local', () => createLocalObjectStore({ root })],
    ['memory', () => createMemoryObjectStore()],
  ];

  for (const [name, make] of cases) {
    describe(name, () => {
      it('round-trips bytes exactly', async () => {
        const store = make();
        const body = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 0xff, 0xd9]);
        await store.put({ key: 'attachments/v1/u/x.jpg', body, contentType: 'image/jpeg' });
        const got = await store.get('attachments/v1/u/x.jpg');
        expect(got).not.toBeNull();
        expect(Buffer.from(got!.body)).toEqual(Buffer.from(body));
      });

      it('returns null for missing keys', async () => {
        const store = make();
        expect(await store.get('attachments/v1/u/absent.jpg')).toBeNull();
      });

      it('deletes idempotently', async () => {
        const store = make();
        await store.put({ key: 'k/x.jpg', body: new Uint8Array([1]), contentType: 'image/jpeg' });
        await store.delete('k/x.jpg');
        await store.delete('k/x.jpg');
        expect(await store.get('k/x.jpg')).toBeNull();
      });
    });
  }

  it('local driver mirrors keys on disk', async () => {
    const store = createLocalObjectStore({ root });
    const body = new Uint8Array([1, 2, 3]);
    await store.put({ key: 'attachments/v1/u1/abc.jpg', body, contentType: 'image/jpeg' });
    const onDisk = await readFile(join(root, 'attachments/v1/u1/abc.jpg'));
    expect(Buffer.from(onDisk)).toEqual(Buffer.from(body));
    const dir = await stat(join(root, 'attachments/v1/u1'));
    expect(dir.isDirectory()).toBe(true);
  });

  it('local driver rejects traversal keys', async () => {
    const store = createLocalObjectStore({ root });
    await expect(
      store.put({ key: '../escape.jpg', body: new Uint8Array([1]), contentType: 'image/jpeg' }),
    ).rejects.toThrow(/invalid object key/);
  });
});

describe('storageConfigFromEnv', () => {
  const fullEnv = {
    OBJECT_STORAGE_BUCKET: 'wingmic-photos',
    OBJECT_STORAGE_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
    OBJECT_STORAGE_ACCESS_KEY_ID: 'key',
    OBJECT_STORAGE_SECRET_ACCESS_KEY: 'secret',
    OBJECT_STORAGE_REGION: 'auto',
  };

  it('picks s3 only when every required credential is present', () => {
    const config = storageConfigFromEnv(fullEnv);
    expect(config).toEqual({
      driver: 's3',
      bucket: 'wingmic-photos',
      endpoint: 'https://acct.r2.cloudflarestorage.com',
      region: 'auto',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    });

    const required = [
      'OBJECT_STORAGE_BUCKET',
      'OBJECT_STORAGE_ENDPOINT',
      'OBJECT_STORAGE_ACCESS_KEY_ID',
      'OBJECT_STORAGE_SECRET_ACCESS_KEY',
    ] as const;
    for (const missing of required) {
      const partial = { ...fullEnv } as Record<string, string | undefined>;
      delete partial[missing];
      expect(storageConfigFromEnv(partial).driver).toBe('local');
    }
  });

  it('falls back to local silently, honoring the root override', () => {
    const config = storageConfigFromEnv({ OBJECT_STORAGE_LOCAL_ROOT: '/tmp/photos' });
    expect(config).toEqual({ driver: 'local', root: '/tmp/photos' });
    expect(storageConfigFromEnv({})).toEqual({ driver: 'local', root: '.object-storage' });
  });

  it('treats blank-string env vars as unset (empty .env entries)', () => {
    expect(
      storageConfigFromEnv({ ...fullEnv, OBJECT_STORAGE_SECRET_ACCESS_KEY: '   ' }).driver,
    ).toBe('local');
  });
});

describe('createObjectStore', () => {
  it('dispatches by driver discriminator', () => {
    expect(createObjectStore({ driver: 'memory' }).driver).toBe('memory');
    expect(createObjectStore({ driver: 'local', root: '/tmp/x' }).driver).toBe('local');
  });
});

describe('s3 driver', () => {
  const config = {
    bucket: 'wingmic-photos',
    endpoint: 'https://acct.r2.cloudflarestorage.com',
    accessKeyId: 'key',
    secretAccessKey: 'secret',
  };

  function fakeClient(
    impl: (command: PutObjectCommand | GetObjectCommand | DeleteObjectCommand) => unknown,
  ): S3ObjectStoreClient & { sent: unknown[] } {
    const sent: unknown[] = [];
    return {
      sent,
      async send(command) {
        sent.push(command);
        return impl(command) as never;
      },
    } as S3ObjectStoreClient & { sent: unknown[] };
  }

  it('puts with bucket, key, body and content type', async () => {
    const client = fakeClient(() => ({}));
    const store = createS3ObjectStore(config, client);
    const body = new Uint8Array([1, 2, 3]);
    await store.put({ key: 'attachments/v1/u/h.jpg', body, contentType: 'image/jpeg' });
    const sent = client.sent[0] as PutObjectCommand;
    expect(sent).toBeInstanceOf(PutObjectCommand);
    expect(sent.input.Bucket).toBe('wingmic-photos');
    expect(sent.input.Key).toBe('attachments/v1/u/h.jpg');
    expect(sent.input.ContentType).toBe('image/jpeg');
    expect(sent.input.Body).toEqual(body);
  });

  it('gets bytes back and maps NotFound to null', async () => {
    const body = new Uint8Array([9, 8, 7]);
    const client = fakeClient((command) => {
      if (command instanceof GetObjectCommand && command.input.Key === 'missing.jpg') {
        const err = new Error('not found') as Error & { name: string };
        err.name = 'NoSuchKey';
        throw err;
      }
      return {
        Body: { transformToByteArray: async () => body },
      };
    });
    const store = createS3ObjectStore(config, client);
    expect(Buffer.from((await store.get('present.jpg'))!.body)).toEqual(Buffer.from(body));
    expect(await store.get('missing.jpg')).toBeNull();
  });

  it('propagates non-NotFound errors', async () => {
    const client = fakeClient(() => {
      throw new Error('network down');
    });
    const store = createS3ObjectStore(config, client);
    await expect(store.get('k.jpg')).rejects.toThrow('network down');
  });
});
