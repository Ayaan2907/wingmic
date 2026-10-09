-- libSQL native vector index on event.embedding for vector_top_k() recall (#103).
-- Hand-written (drizzle-kit doesn't know about libsql_vector_idx); applied by
-- the standard migrator after 0017_bumpy_fantastic_four.sql. Idempotent.
CREATE INDEX IF NOT EXISTS `event_embedding_vector_idx`
  ON `event` (libsql_vector_idx(embedding));
