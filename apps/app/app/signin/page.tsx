import SignInClient from './SignInClient';

export const metadata = {
  title: 'sign in',
  description: 'sign in to wingmic — magic link, no password.',
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  return <SignInClient next={sp?.next ?? '/chat'} />;
}
