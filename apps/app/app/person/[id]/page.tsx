// app/person/[id]/page.tsx — entity detail page (PR β₂).
//
// Server prefetches the detail via the entity router's createCaller (same
// pattern recall.test.ts uses, applied at the server-page boundary). 404s if
// the entity isn't owned by this user or has been soft-deleted; redirects
// unauthenticated users to /signin?next=/person/{id}.

import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { TRPCError } from '@trpc/server';
import { auth } from '@/lib/auth';
import { db } from '@wingmic/db';
import { entityRouter } from '@/lib/trpc/routers/entity';
import PersonDetailClient from './PersonDetailClient';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(`/signin?next=${encodeURIComponent(`/person/${id}`)}`);
  }

  const caller = entityRouter.createCaller({
    db,
    session,
    user: session.user,
    headers: await headers(),
  } as Parameters<typeof entityRouter.createCaller>[0]);

  try {
    const detail = await caller.detail({ kind: 'person', id });
    if (detail.kind !== 'person') notFound();
    return <PersonDetailClient detail={detail} />;
  } catch (err) {
    if (err instanceof TRPCError && err.code === 'NOT_FOUND') notFound();
    throw err;
  }
}
