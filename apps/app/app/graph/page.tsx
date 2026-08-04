// app/graph/page.tsx — graph screen (PR ι-graph).
//
// Server component: resolves the session (redirect to /signin if absent),
// then loads the user's whole graph via the graph router's createCaller —
// same server-page boundary pattern as person/[id]/page.tsx. The AppShell
// (PR λ-shell) wraps this from the root layout, so no nav is rendered here.

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@wingmic/db';
import { graphRouter } from '@/lib/trpc/routers/graph';
import { GraphClient } from './GraphClient';

export const metadata = { title: 'graph' };

export const dynamic = 'force-dynamic';

export default async function Page() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.user) {
    redirect('/signin?next=/graph');
  }

  const caller = graphRouter.createCaller({
    db,
    session,
    user: session.user,
    headers: reqHeaders,
  } as Parameters<typeof graphRouter.createCaller>[0]);

  const data = await caller.get();
  return <GraphClient data={data} />;
}
