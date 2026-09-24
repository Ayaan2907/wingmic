import {
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
  PutObjectCommand,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import type { ObjectStore, PutObjectInput, StoredObject } from '../types';

/**
 * The subset of S3Client this driver touches. Tests can pass a fake;
 * production passes a real S3Client (R2-compatible via forcePathStyle).
 */
export interface S3ObjectStoreClient {
  send(command: PutObjectCommand | GetObjectCommand | DeleteObjectCommand): Promise<{
    Body?: { transformToByteArray(): Promise<Uint8Array> };
  }>;
}

export type S3ObjectStoreConfig = {
  bucket: string;
  /** R2 endpoint or an S3 regional endpoint, e.g. https://<account>.r2.cloudflarestorage.com */
  endpoint?: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export function createS3Client(config: S3ObjectStoreConfig): S3Client {
  const clientConfig: S3ClientConfig = {
    // R2 ignores region but the SDK requires one — 'auto' is its convention.
    region: config.region || 'auto',
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Path-style URLs are required for R2 and MinIO, and harmless on AWS.
    forcePathStyle: true,
  };
  if (config.endpoint) {
    clientConfig.endpoint = config.endpoint;
  }
  return new S3Client(clientConfig);
}

export function createS3ObjectStore(
  config: S3ObjectStoreConfig,
  client: S3ObjectStoreClient = createS3Client(config),
): ObjectStore {
  const bucket = config.bucket;

  return {
    driver: 's3',

    async put(input: PutObjectInput): Promise<void> {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
        }),
      );
    },

    async get(key: string): Promise<StoredObject | null> {
      try {
        const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!res.Body) return null;
        return {
          body: await res.Body.transformToByteArray(),
          contentType: 'application/octet-stream',
        };
      } catch (err) {
        // Both AWS and R2 surface missing keys as NotFound / NoSuchKey names.
        const name = (err as { name?: string }).name;
        const code = (err as { Code?: string }).Code;
        if (name === 'NotFound' || code === 'NoSuchKey' || name === 'NoSuchKey') return null;
        throw err;
      }
    },

    async delete(key: string): Promise<void> {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
