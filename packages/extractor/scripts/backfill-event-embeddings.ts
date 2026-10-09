/**
 * Backfill null event.embedding rows (#103). Requires OPENROUTER_API_KEY
 * (same embedder as capture/recall).
 *
 * Usage:
 *   TURSO_DB_URL="file:/path/to/local.db" bun run db:backfill:event-embeddings
 */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import * as schema from '@wingmic/db/schema';
import { eventEmbedText } from '../src/eventEmbed';
import { embedTexts } from '../src/embeddings';
import { env } from '../../../apps/app/lib/config/env';

const BATCH = 32;

async function main() {
  const client = createClient({
    url: env.TURSO_DB_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
  const db = drizzle(client, { schema });

  const all = await db.query.events.findMany({
    columns: { id: true, name: true, location: true, embedding: true },
  });
  const rows = all.filter((e) => !e.embedding?.length);

  if (rows.length === 0) {
    console.log('[backfill:event-embeddings] nothing to do');
    client.close();
    return;
  }

  console.log(`[backfill:event-embeddings] ${rows.length} event(s) missing embeddings`);

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const texts = batch.map((e) => eventEmbedText(e));
    const vectors = await embedTexts(texts);
    for (let j = 0; j < batch.length; j++) {
      await db
        .update(schema.events)
        .set({ embedding: vectors[j] })
        .where(eq(schema.events.id, batch[j].id));
    }
    console.log(`[backfill:event-embeddings] updated ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }

  client.close();
  console.log('[backfill:event-embeddings] done');
}

main().catch((err) => {
  console.error('[backfill:event-embeddings] failed:', err);
  process.exit(1);
});
