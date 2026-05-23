import { generateObject } from 'ai';
import { env } from '../../../apps/app/lib/config/env';
import { ExtractionResult } from './schema';
import { SYSTEM_PROMPT, userPrompt } from './prompt';
import { extractionModel } from './models';

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
 * Extract structured networking data from a transcript via the configured
 * LLM (default: claude-haiku-4-5 via OpenRouter) + Vercel AI SDK's
 * `generateObject` with the Zod schema.
 *
 * v0.1.1 locked decision #9: model selection lives in models.ts; all calls
 * route through OpenRouter. Swap providers by changing EXTRACTION_MODEL env.
 *
 * Throws ExtractionError on:
 *   - missing OPENROUTER_API_KEY
 *   - LLM rate-limit / 429 (caller should retry with backoff)
 *   - schema-validation failure (model returned invalid shape)
 */
export async function extract(transcript: string): Promise<ExtractionResult> {
  if (!env.OPENROUTER_API_KEY) {
    throw new ExtractionError('OPENROUTER_API_KEY is not set');
  }
  if (!transcript.trim()) {
    return { persons: [], companies: [], events: [], topics: [], actions: [] };
  }
  try {
    const { object } = await generateObject({
      model: extractionModel,
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
