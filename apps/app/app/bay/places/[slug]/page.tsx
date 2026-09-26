// apps/app/app/bay/places/[slug]/page.tsx — public place detail. Places are
// canonical public rows (no session needed); the page renders them through
// the EntityDetailScaffold extended with kind 'place' and hidden activity
// sections (places have no interaction history — hiding beats an empty card
// that promises captures are coming).

import { notFound } from 'next/navigation';
import { db } from '@wingmic/db';
import { loadBayPlace } from '@/lib/bay/store';
import PlaceDetail from '../../PlaceDetail';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const id = decodeURIComponent(slug);
  const { record } = await loadBayPlace(db, id);
  if (!record) notFound();
  return <PlaceDetail place={record} />;
}
