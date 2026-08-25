import SignInClient from './SignInClient';
import { safeNextPath } from './safeNext';

export const metadata = {
  title: 'sign in',
  description: 'sign in to wingmic — magic link, no password.',
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const sp = await searchParams;
  return <SignInClient next={safeNextPath(sp?.next)} />;
}
