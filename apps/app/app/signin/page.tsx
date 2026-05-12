import SignInClient from './SignInClient';

export const metadata = {
  title: 'sign in',
  description: 'sign in to wingmic — magic link, no password.',
};

export default function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <SignInClient searchParamsPromise={searchParams} />;
}
