import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { ExtractionResult } from './schema';
import { SYSTEM_PROMPT, userPrompt } from './prompt';

const MODEL = process.env.ANTHROPIC_EXTRACTION_MODEL ?? 'claude-sonnet-4-6';

export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

/**
 * Extract structured networking data from a transcript via Claude
 * Sonnet 4.6 + Vercel AI SDK's `generateObject` with the Zod schema.
 *
 * Throws ExtractionError on:
 *   - missing ANTHROPIC_API_KEY
 *   - LLM rate-limit / 429 (caller should retry with backoff)
 *   - schema-validation failure (Claude returned invalid shape)
 */
export async function extract(transcript: string): Promise<ExtractionResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ExtractionError('ANTHROPIC_API_KEY is not set');
  }
  if (!transcript.trim()) {
    return { persons: [], companies: [], events: [], topics: [], actions: [] };
  }
  try {
    const { object } = await generateObject({
      model: anthropic(MODEL),
      schema: ExtractionResult,
      system: SYSTEM_PROMPT,
      prompt: userPrompt(transcript),
      temperature: 0.1,
    });
    return object;
  } catch (err) {
    throw new ExtractionError(
      err instanceof Error ? err.message : 'unknown extraction failure',
      err,
    );
  }
}
