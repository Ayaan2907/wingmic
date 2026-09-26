'use client';

// apps/app/app/bay/PlaceDetail.tsx — the place view of the shared entity
// scaffold: hero, first-person note, provenance stats, and map round-trip.
// Activity sections are hidden (places have no captures or follow-ups).

import { useRouter } from 'next/navigation';
import { EntityDetailScaffold } from '@/app/_components/entity/EntityDetailScaffold';
import type { PlaceRecord } from '@/lib/bay/store';
import { COPY } from './copy';

export default function PlaceDetail({ place }: { place: PlaceRecord }) {
  const router = useRouter();
  const when = new Date(place.firstSeenAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <EntityDetailScaffold
      kind="place"
      eyebrow={place.category}
      name={place.title}
      sub={place.note}
      hero={
        <div
          aria-hidden="true"
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'rgba(134, 239, 172, 0.15)',
            border: '1px solid rgba(134, 239, 172, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
          }}
        >
          ⌖
        </div>
      }
      tags={[place.category]}
      primaryCta={{ label: 'open the map', onClick: () => router.push('/bay') }}
      ghostCta={
        place.sourceUrl
          ? {
              label: 'source',
              title: place.sourceUrl,
              onClick: () => window.open(place.sourceUrl ?? '', '_blank', 'noopener'),
            }
          : { label: 'back home', onClick: () => router.push('/') }
      }
      stats={[
        { key: 'category', value: place.category },
        { key: 'on the map since', value: when },
        {
          key: 'where',
          value:
            place.lat != null && place.lng != null
              ? `${place.lat.toFixed(3)}, ${place.lng.toFixed(3)}`
              : COPY.placeNoCoords,
        },
      ]}
      captures={[]}
      followups={[]}
      related={[]}
      hideActivity
    />
  );
}
