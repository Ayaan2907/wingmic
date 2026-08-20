export { extract, ExtractionError } from './client';
export { embedText, embedTexts, cosine, EmbeddingError } from './embeddings';
export { commit, type CommitResult, type CommitPersonResolution } from './resolution';
export { slugify, nameSimilarity } from './slug';
export {
  fingerprint,
  personaDraftFromPerson,
  canonicalizeEmail,
  canonicalizeLinkedin,
  isStrongFingerprint,
  type Fingerprint,
  type FingerprintKind,
  type PersonaDraft,
} from './fingerprint';
export {
  ExtractionResult,
  PersonCandidate,
  CompanyCandidate,
  EventCandidate,
  ActionCandidate,
} from './schema';
export { SYSTEM_PROMPT, userPrompt } from './prompt';
export { extractHybrid, mapProviderEntities, applyHeuristics, mergeResults, sanitizeExtraction, extractTopicPhrases } from './hybrid';
export type { AssemblyAIEntity } from './types';
