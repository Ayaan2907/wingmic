// app/page.tsx — Home / dashboard (PR α v9).
//
// Replaces the v0.1.1 auto-redirect to /capture. Authenticated users now
// see the v2 ScreenHome (see design/v2/library/lib-screens.jsx). Unauth
// users still redirect to /signin so the funnel is unchanged.
//
// Data is fetched here in the server component via a direct Drizzle
// query against `interactions` (committed, not soft-deleted). Kept simple
// for v0.1.2 PR α — no tRPC router needed yet; promote when a second
// consumer appears.

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { and, count, desc, eq, gte, inArray, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@wingmic/db';
import HomeClient, { type HomeInitialData, type HomeRecentItem } from './HomeClient';

export const metadata = {
  title: 'home · wingmic',
  description: 'your social ram — today, this week, recent commits.',
};

export const dynamic = 'force-dynamic';

const RECENT_LIMIT = 5;
const PREVIEW_CHARS = 60;

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/signin');

  const initialData = await loadHomeData(session.user.id);
  return <HomeClient userName={session.user.name ?? null} initialData={initialData} />;
}

async function loadHomeData(userId: string): Promise<HomeInitialData> {
  // Day + week boundaries are computed server-side. The Drizzle interaction
  // table stores `capturedAt` as a unix-second timestamp (`mode: 'timestamp'`),
  // so we compare against Date objects directly.
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay);
  // Week begins at start-of-day 7 days ago. Rolling window, not calendar week —
  // matches the casual "this week" framing on the home screen.
  startOfWeek.setDate(startOfWeek.getDate() - 6);

  const baseWhere = and(
    eq(schema.interactions.userId, userId),
    eq(schema.interactions.status, 'committed'),
    isNull(schema.interactions.deletedAt),
  );

  // Two count queries + one list query. Run in parallel — they share no state.
  const [todayRow, weekRow, recentRows] = await Promise.all([
    db
      .select({ n: count() })
      .from(schema.interactions)
      .where(and(baseWhere, gte(schema.interactions.capturedAt, startOfDay))),
    db
      .select({ n: count() })
      .from(schema.interactions)
      .where(and(baseWhere, gte(schema.interactions.capturedAt, startOfWeek))),
    db
      .select({
        id: schema.interactions.id,
        capturedAt: schema.interactions.capturedAt,
        transcript: schema.interactions.transcript,
      })
      .from(schema.interactions)
      .where(baseWhere)
      .orderBy(desc(schema.interactions.capturedAt))
      .limit(RECENT_LIMIT),
  ]);

  // Entity count per interaction — single grouped query keyed on
  // sourceInteractionId. Cheaper than N round-trips. Returns rows only for
  // interactions that have at least one entity_company / entity_event /
  // entity_topic / entity_fact reference; missing keys default to 0.
  const ids = recentRows.map((r) => r.id);
  const entityCounts = ids.length > 0 ? await loadEntityCounts(ids) : new Map<string, number>();

  const recent: HomeRecentItem[] = recentRows.map((r) => ({
    id: r.id,
    // libSQL HTTP driver path may return integer instead of Date; defensive cast.
    capturedAt: (r.capturedAt instanceof Date ? r.capturedAt : new Date(r.capturedAt as unknown as number)).toISOString(),
    transcriptPreview: previewOf(r.transcript ?? ''),
    entityCount: entityCounts.get(r.id) ?? 0,
  }));

  return {
    todayCount: todayRow[0]?.n ?? 0,
    weekCount: weekRow[0]?.n ?? 0,
    pendingActs: 0, // v0.3 — acts table doesn't exist yet.
    recent,
  };
}

/**
 * Count entity references per interaction. v0.1.2 PR α scope: we look at the
 * two edge tables that carry `sourceInteractionId` (entity_fact, entity_topic)
 * and sum their counts grouped by interaction. Companies + events edges don't
 * yet carry the source link (see schema.ts — added in PR β). Result is a
 * non-zero floor on entities-per-memo, which is the badge's intent.
 */
async function loadEntityCounts(interactionIds: string[]): Promise<Map<string, number>> {
  if (interactionIds.length === 0) return new Map();
  const out = new Map<string, number>();
  const [factRows, topicRows] = await Promise.all([
    db
      .select({
        id: schema.entityFacts.sourceInteractionId,
        n: count(),
      })
      .from(schema.entityFacts)
      .where(inArray(schema.entityFacts.sourceInteractionId, interactionIds))
      .groupBy(schema.entityFacts.sourceInteractionId),
    db
      .select({
        id: schema.entityTopics.sourceInteractionId,
        n: count(),
      })
      .from(schema.entityTopics)
      .where(inArray(schema.entityTopics.sourceInteractionId, interactionIds))
      .groupBy(schema.entityTopics.sourceInteractionId),
  ]);
  for (const r of factRows) if (r.id) out.set(r.id, (out.get(r.id) ?? 0) + Number(r.n));
  for (const r of topicRows) if (r.id) out.set(r.id, (out.get(r.id) ?? 0) + Number(r.n));
  return out;
}

function previewOf(transcript: string): string {
  const trimmed = transcript.trim();
  if (trimmed.length <= PREVIEW_CHARS) return trimmed;
  return trimmed.slice(0, PREVIEW_CHARS - 1) + '…';
}
