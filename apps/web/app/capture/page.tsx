import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import CaptureClient from './CaptureClient';

export const metadata = {
  title: 'capture',
  description: 'speak. extract. commit. wingmic remembers.',
};

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/signin?next=/capture');
  return <CaptureClient userName={session.user.name ?? null} />;
}
