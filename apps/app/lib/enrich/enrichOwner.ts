import type { DB } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';
import { and, eq } from 'drizzle-orm';
import {
  buildWebSearchQuery,
  isBlockedExtractUrl,
  type WebSearchProvider,
} from '@/lib/web-search';

/**
 * After the owner pastes a LinkedIn URL at onboarding, look up public hits.
 * Never extract LinkedIn HTML. Never create a person row for the signed-in user.
 * A homepage (non-LinkedIn) lands as identity_claim(kind='url') if that kind is blank.
 */
export async function enrichOwnerAfterLinkedin(opts: {
  db: DB;
  userId: string;
  linkedinUrl: string;
  name?: string | null;
  provider: WebSearchProvider | null;
}): Promise<void> {
  const { db, userId, linkedinUrl, name, provider } = opts;
  if (!provider) return;

  const query = buildWebSearchQuery({
    intent: 'person',
    name: name ?? undefined,
    q: [name, linkedinUrl].filter((v) => v?.trim()).join(' '),
  });
  if (!query.q.trim()) return;

  const hits = await provider.search(query);
  const homepage = hits.find((h) => !isBlockedExtractUrl(h.url))?.url;
  if (!homepage) return;

  const existing = await db.query.identityClaims.findFirst({
    where: and(eq(schema.identityClaims.userId, userId), eq(schema.identityClaims.kind, 'url')),
    columns: { id: true },
  });
  if (existing) return;

  await db.insert(schema.identityClaims).values({
    userId,
    kind: 'url',
    value: homepage,
    verified: false,
    public: false,
  });
}
