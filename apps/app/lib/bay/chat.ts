import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import type { ChatFn } from '@wingmic/bay';
import { env } from '@/lib/config/env';

/**
 * The bay explain stage's chat function — the pure core's ChatFn shape over the
 * same OpenRouter provider the extractor uses. No key configured returns null:
 * callers answer with the deterministic fallback templates, so a missing
 * OPENROUTER_API_KEY is a feature flag for honesty, never an error. The model
 * default is EXTRACTION_MODEL — the bay explain adds no new env var.
 */
export function getExplainChat(): ChatFn | null {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  const openrouter = createOpenRouter({ apiKey });
  return async (messages, opts) => {
    const { text } = await generateText({
      model: openrouter(opts?.model || env.EXTRACTION_MODEL),
      messages,
    });
    return text;
  };
}
