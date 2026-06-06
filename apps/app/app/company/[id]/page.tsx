// app/company/[id]/page.tsx — entity detail page (PR β₂).

import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { TRPCError } from '@trpc/server';
import { auth } from '@/lib/auth';
import { db } from '@wingmic/db';
import { entityRouter } from '@/lib/trpc/routers/entity';
import CompanyDetailClient from './CompanyDetailClient';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Read request headers once, reuse for auth session + tRPC caller context.
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.user) {
    redirect(`/signin?next=${encodeURIComponent(`/company/${id}`)}`);
  }

  const caller = entityRouter.createCaller({
    db,
    session,
    user: session.user,
    headers: reqHeaders,
  } as Parameters<typeof entityRouter.createCaller>[0]);

  try {
    const detail = await caller.detail({ kind: 'company', id });
    if (detail.kind !== 'company') notFound();
    return <CompanyDetailClient detail={detail} />;
  } catch (err) {
    if (err instanceof TRPCError && err.code === 'NOT_FOUND') notFound();
    throw err;
  }
}
