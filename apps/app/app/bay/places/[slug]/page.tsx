// apps/app/app/bay/places/[slug]/page.tsx — public place detail. Places are
// canonical public rows (no session needed); the page renders them through
// the EntityDetailScaffold extended with kind 'place' and hidden activity
// sections (places have no interaction history — hiding beats an empty card
// that promises captures are coming).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { db } from '@wingmic/db';
import { loadBayPlace } from '@/lib/bay/store';
import PlaceDetail from '../../PlaceDetail';

export const dynamic = 'force-dynamic';

// generateMetadata and Page each need the same place; cache() dedupes the
// lookup to one DB read per request (Next only dedupes fetch, not async DB calls)
const getPlace = cache((id: string) => loadBayPlace(db, id));

// the app-wide layout sets robots noindex; a public place page is part of the
// shareable bay — this override is what makes it indexable (same as /bay)
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { record } = await getPlace(decodeURIComponent(slug));
  if (!record) return { title: 'place not found — the bay' };
  return {
    title: `${record.title} — the bay, wingmic`,
    description: record.note,
    robots: { index: true, follow: true },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = decodeURIComponent(slug);
  const { record } = await getPlace(id);
  if (!record) notFound();
  return <PlaceDetail place={record} />;
}
