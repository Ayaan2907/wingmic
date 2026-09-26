// apps/app/app/bay/page.tsx — the public map route. The app-wide layout sets
// robots noindex; the bay is the shareable, indexable acquisition surface
// (?q= deep links), so this route overrides it. Chromeless via
// EventSessionProvider.CHROMELESS_ROUTES — the map owns its full viewport.
//
// The render is dynamic and fires the bay funnel's map_view server-side
// (taxonomy contract: a render is what the event measures; signed-out
// renders aggregate under the fixed bay_anonymous bucket).

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { ANALYTICS_EVENTS, BAY_ANONYMOUS_ID } from '@/lib/analytics/events';
import { trackAnalyticsEvent } from '@/lib/analytics/server';
import BayClient from './BayClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'the bay — wingmic',
  description:
    'A map of the Bay Area worth showing up in: curated places with first-person notes, live events, and an ask bar that answers who to meet and where to go.',
  robots: { index: true, follow: true },
};

export default async function BayPage() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  trackAnalyticsEvent(session?.user.id ?? BAY_ANONYMOUS_ID, ANALYTICS_EVENTS.mapView, {
    signedIn: Boolean(session),
  });
  return <BayClient />;
}
