/**
 * Single source of truth for model selection.
 *
 * v0.1.1 "Hosted Capture" locked decisions #6 + #9:
 *   - `models.ts` is the only file that names models.
 *   - All LLM + embedding calls route through OpenRouter.
 *
 * Provider swap = change one env value (e.g., EXTRACTION_MODEL=openai/gpt-4o-mini).
 * No code change required.
 *
 * NOTE: This module imports from apps/app/lib/config/env, which violates the
 * intended package boundary (see issue #12 / plan TODO). Accepted as v0.1.1
 * technical debt; will be fixed by `packages/env` in v0.1.2.
 */
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel, EmbeddingModel } from 'ai';
import { env } from '../../../apps/app/lib/config/env';

const openrouter = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY ?? '' });

export const extractionModel: LanguageModel = openrouter(env.EXTRACTION_MODEL);
export const linkerModel: LanguageModel = openrouter(env.LINKER_MODEL);
export const embeddingModel: EmbeddingModel = openrouter.textEmbeddingModel(env.EMBEDDING_MODEL);
