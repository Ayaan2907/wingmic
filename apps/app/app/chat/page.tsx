// app/chat/page.tsx — chat surface (PR β₁-A).
//
// chat IS the capture surface. See design/v2/design.md §12 "one mic, one
// surface". The /capture route still renders the same client for one
// release; β₁-B replaces /capture/page.tsx with a redirect to
// /chat?armRecord=1.
//
// Server-prefetches the last 20 committed memos so the thread isn't
// empty on load. Same Drizzle-direct pattern Home uses (apps/app/app/page.tsx).

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db, schema } from '@wingmic/db';
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

  // libSQL HTTP driver may return integer instead of Date; defensive cast
  // matches HomeClient's prefetch path. Reverse to oldest-first so the
  // thread renders top-down chronologically.
  const items: ChatInitialItem[] = rows.map((r) => ({
    id: r.id,
    transcript: r.transcript ?? '',
    capturedAt: (r.capturedAt instanceof Date
      ? r.capturedAt
      : new Date(r.capturedAt as unknown as number)
    ).toISOString(),
  }));
  items.reverse();
  return items;
}
