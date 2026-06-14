import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import SearchClient from './SearchClient';

export const metadata = {
  title: 'search',
  description: 'ask anything about who you know.',
};

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/signin?next=/search');
  return <SearchClient />;
}
