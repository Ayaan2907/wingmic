// apps/app/app/bay/page.tsx — the public map route. The app-wide layout sets
// robots noindex; the bay is the shareable, indexable acquisition surface
// (?q= deep links), so this route overrides it. Chromeless via
// EventSessionProvider.CHROMELESS_ROUTES — the map owns its full viewport.

import type { Metadata } from 'next';
import BayClient from './BayClient';

export const metadata: Metadata = {
  title: 'the bay — wingmic',
  description:
    'A map of the Bay Area worth showing up in: curated places with first-person notes, live events, and an ask bar that answers who to meet and where to go.',
  robots: { index: true, follow: true },
};

export default function BayPage() {
  return <BayClient />;
}
