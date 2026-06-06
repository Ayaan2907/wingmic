// app/event/[id]/page.tsx — entity detail page (PR β₂).

import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { TRPCError } from '@trpc/server';
import { auth } from '@/lib/auth';
import { db } from '@wingmic/db';
import { entityRouter } from '@/lib/trpc/routers/entity';
import EventDetailClient from './EventDetailClient';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(`/signin?next=${encodeURIComponent(`/event/${id}`)}`);
  }

  const caller = entityRouter.createCaller({
    db,
    session,
    user: session.user,
    headers: await headers(),
  } as Parameters<typeof entityRouter.createCaller>[0]);

  try {
    const detail = await caller.detail({ kind: 'event', id });
    if (detail.kind !== 'event') notFound();
    return <EventDetailClient detail={detail} />;
  } catch (err) {
    if (err instanceof TRPCError && err.code === 'NOT_FOUND') notFound();
    throw err;
  }
}
