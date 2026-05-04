export { extract, ExtractionError } from './client';
export { embedText, embedTexts, cosine, EmbeddingError } from './embeddings';
export { commit, type CommitResult } from './resolution';
export { slugify, nameSimilarity } from './slug';
export {
  ExtractionResult,
  PersonCandidate,
  CompanyCandidate,
  EventCandidate,
  ActionCandidate,
} from './schema';
export { SYSTEM_PROMPT, userPrompt } from './prompt';
