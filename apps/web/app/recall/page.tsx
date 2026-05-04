import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import RecallClient from './RecallClient';

export const metadata = {
  title: 'recall',
  description: 'ask anything about who you know.',
};

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/signin?next=/recall');
  return <RecallClient />;
}
