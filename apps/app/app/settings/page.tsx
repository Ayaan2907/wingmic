import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import SettingsClient from './SettingsClient';

export const metadata = { title: 'settings' };

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/signin?next=/settings');

  return <SettingsClient email={session.user.email} />;
}
