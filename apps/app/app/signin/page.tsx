import SignInClient from './SignInClient';
import { safeNextPath } from './safeNext';

export const metadata = {
  title: 'sign in',
  description: 'sign in to wingmic — magic link, no password.',
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; email?: string | string[] }>;
}) {
  const sp = await searchParams;
  const rawEmail = Array.isArray(sp?.email) ? sp.email[0] : sp?.email;
  const email = typeof rawEmail === 'string' && rawEmail.length <= 254 ? rawEmail : '';
  return <SignInClient next={safeNextPath(sp?.next)} initialEmail={email} />;
}
