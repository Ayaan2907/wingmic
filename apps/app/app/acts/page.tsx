import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { ActsClient } from './ActsClient';

export const metadata = { title: 'acts' };

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/signin?next=/acts');

  return <ActsClient />;
}
