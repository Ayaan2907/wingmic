-- libSQL native vector index on entity.embedding for vector_top_k() queries.
-- Hand-written (drizzle-kit doesn't know about libsql_vector_idx); skipped by
-- drizzle generate but applied by the standard migrator. Idempotent.
--
-- Query shape:
--   SELECT id FROM vector_top_k('entity_embedding_vector_idx', vector(?), ?)
--
-- Reference: https://docs.turso.tech/features/ai-and-embeddings
CREATE INDEX IF NOT EXISTS `entity_embedding_vector_idx`
  ON `entity` (libsql_vector_idx(embedding));
