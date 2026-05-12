import { openai } from '@ai-sdk/openai';
import { embed, embedMany } from 'ai';
import { env } from '../config/env';

const MODEL = openai.textEmbeddingModel(env.OPENAI_EMBEDDING_MODEL);

export class EmbeddingError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

/** Single-string embedding. Returns a number[] of length 1536. */
export async function embedText(value: string): Promise<number[]> {
  if (!env.OPENAI_API_KEY) {
    throw new EmbeddingError('OPENAI_API_KEY is not set');
  }
  if (!value.trim()) {
    throw new EmbeddingError('cannot embed an empty string');
  }
  try {
    const { embedding } = await embed({ model: MODEL, value });
    return embedding;
  } catch (err) {
    throw new EmbeddingError(
      err instanceof Error ? err.message : 'unknown embedding failure',
      err,
    );
  }
}

/** Batch embeddings for N strings. Returns array of length N. */
export async function embedTexts(values: string[]): Promise<number[][]> {
  if (!env.OPENAI_API_KEY) {
    throw new EmbeddingError('OPENAI_API_KEY is not set');
  }
  if (values.length === 0) return [];
  try {
    const { embeddings } = await embedMany({ model: MODEL, values });
    return embeddings;
  } catch (err) {
    throw new EmbeddingError(
      err instanceof Error ? err.message : 'unknown embedding failure',
      err,
    );
  }
}

/** Cosine similarity between two equal-length vectors. */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosine: dim mismatch ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let aMag = 0;
  let bMag = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aMag += a[i] * a[i];
    bMag += b[i] * b[i];
  }
  const denom = Math.sqrt(aMag) * Math.sqrt(bMag);
  return denom === 0 ? 0 : dot / denom;
}
