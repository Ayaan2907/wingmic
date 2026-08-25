import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { TRPCError } from '@trpc/server';
import { auth } from '@/lib/auth';
import { db } from '@wingmic/db';
import { entityRouter } from '@/lib/trpc/routers/entity';
import TopicDetailClient from './TopicDetailClient';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.user) {
    redirect(`/signin?next=${encodeURIComponent(`/topic/${id}`)}`);
  }

  const caller = entityRouter.createCaller({
    db,
    session,
    user: session.user,
    headers: reqHeaders,
  } as Parameters<typeof entityRouter.createCaller>[0]);

  try {
    const detail = await caller.detail({ kind: 'topic', id });
    if (detail.kind !== 'topic') notFound();
    return <TopicDetailClient detail={detail} />;
  } catch (err) {
    if (err instanceof TRPCError && err.code === 'NOT_FOUND') notFound();
    throw err;
  }
}
