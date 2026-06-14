import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import OnboardingClient from './OnboardingClient';

export const metadata = { title: 'welcome' };

// LOOP GUARD: this page authenticates but DELIBERATELY does NOT call
// requireOnboarded. The gate redirects un-acknowledged users HERE; calling it
// here would redirect /onboarding → /onboarding forever. Do not add it.
export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/signin?next=/onboarding');

  return <OnboardingClient />;
}
