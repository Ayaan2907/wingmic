import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { ImportsClient } from './ImportsClient';

export const metadata = { title: 'imports' };

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/signin?next=/imports');

  return <ImportsClient />;
}
