import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@wingmic/db';
import { settingsRouter } from '@/lib/trpc/routers/settings';
import SettingsClient from './SettingsClient';

export const metadata = { title: 'settings' };

export const dynamic = 'force-dynamic';

export default async function Page() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.user) redirect('/signin?next=/settings');

  const caller = settingsRouter.createCaller({
    db,
    session,
    user: session.user,
    headers: reqHeaders,
  } as Parameters<typeof settingsRouter.createCaller>[0]);

  const initialSettings = await caller.get();

  return <SettingsClient email={session.user.email} initialSettings={initialSettings} />;
}
