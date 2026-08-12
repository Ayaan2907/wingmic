// app/chat/page.tsx — chat surface (PR β₁-A).
//
// chat IS the capture surface for completed memos. PR β₁-D moved the
// orb itself into the global BottomTabBar (live on every route); the
// commit pipeline routes here after the recorder ends so the bubble +
// extraction land in the thread.
//
// Server-prefetches the last 20 committed memos with hydrated GraphResult
// so agent replies survive refresh (Stream A).

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { requireOnboarded } from '@/lib/onboarding-guard';
import { db, schema } from '@wingmic/db';
import { hydrateThreadItems } from '@/lib/chat/hydrateThread';
import ChatClient from './ChatClient';
import type { ChatInitialItem } from './_components/types';

export const metadata = {
  title: 'chat',
  description: 'speak. extract. commit. wingmic remembers.',
};

export const dynamic = 'force-dynamic';

const INITIAL_LIMIT = 20;

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/signin?next=/chat');

  await requireOnboarded(session.user.id);

  const initialThread = await loadInitialThread(session.user.id);
  return <ChatClient userName={session.user.name ?? null} initialThread={initialThread} />;
}

async function loadInitialThread(userId: string): Promise<ChatInitialItem[]> {
  const rows = await db
    .select({
      id: schema.interactions.id,
      transcript: schema.interactions.transcript,
      capturedAt: schema.interactions.capturedAt,
    })
    .from(schema.interactions)
    .where(
      and(
        eq(schema.interactions.userId, userId),
        eq(schema.interactions.status, 'committed'),
        isNull(schema.interactions.deletedAt),
      ),
    )
    .orderBy(desc(schema.interactions.capturedAt))
    .limit(INITIAL_LIMIT);

  // Reverse to oldest-first so the thread renders top-down chronologically.
  const chronological = [...rows].reverse();
  return hydrateThreadItems(db, userId, chronological);
}
