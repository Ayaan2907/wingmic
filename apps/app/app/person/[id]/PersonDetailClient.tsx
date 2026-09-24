'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  EntityDetailScaffold,
  type EntityCapture,
  type EntityFollowup,
  type EntityRelated,
  type EntityStat,
  type EntityPublicProfile,
  type EntityPossibleMatch,
} from '@/app/_components/entity/EntityDetailScaffold';
import { PersonAvatar } from '@/app/_components/entity/EntityAvatar';
import { PersonListRail } from './_components/PersonListRail';
import { trpc } from '@/lib/trpc/client';
import { parseImportSource } from '@/lib/imports';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/lib/trpc/routers/_app';
import type { EntityEnrichReason } from '@/app/_components/entity/EntityDetailScaffold';

export interface PersonDetail {
  kind: 'person';
  id: string;
  name: string;
  importSource?: string | null;
  sub: {
    role: string | null;
    companyId: string | null;
    companyName: string | null;
    warmFollowup: boolean;
  };
  stats: EntityStat[];
  captures: EntityCapture[];
  followups: EntityFollowup[];
  related: EntityRelated[];
  topics: Array<{ id: string; name: string }>;
  publicProfile?: EntityPublicProfile | null;
  webSearchConfigured?: boolean;
  possibleMatches?: EntityPossibleMatch[];
}

type EnrichResult = inferRouterOutputs<AppRouter>['entity']['enrich'];

/** Map a finished enrich mutation to the card's "why nothing landed" reason.
 * ok with facts written → null (refresh will render them); ok with nothing
 * written → 'empty'; failed / no provider → that reason. */
export function enrichReasonFromResult(res: EnrichResult | undefined): EntityEnrichReason | null {
  if (!res) return null;
  if (res.ok) return res.wroteFactKeys.length === 0 ? 'empty' : null;
  return res.reason;
}

export default function PersonDetailClient({ detail }: { detail: PersonDetail }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [mergePendingId, setMergePendingId] = React.useState<string | null>(null);
  const [mergeUndo, setMergeUndo] = React.useState<{
    mergeId: string;
    sourceName: string;
    expiresAt: number;
  } | null>(null);

  React.useEffect(() => {
    if (!mergeUndo) return;
    const ms = mergeUndo.expiresAt - Date.now();
    if (ms <= 0) {
      setMergeUndo(null);
      return;
    }
    const t = window.setTimeout(() => setMergeUndo(null), ms);
    return () => window.clearTimeout(t);
  }, [mergeUndo]);

  const createDraft = trpc.acts.createDraft.useMutation({
    onSuccess: (res) => {
      if (res.ok) router.push('/acts');
    },
  });

  const merge = trpc.entity.merge.useMutation({
    onMutate: ({ sourceId }) => setMergePendingId(sourceId),
    onSuccess: (res) => {
      setMergeUndo({
        mergeId: res.mergeId,
        sourceName: res.sourceName,
        expiresAt: Date.now() + 30_000,
      });
      void utils.entity.detail.invalidate({ kind: 'person', id: detail.id });
      router.refresh();
    },
    onSettled: () => setMergePendingId(null),
  });

  const undoMerge = trpc.entity.undoMerge.useMutation({
    onSuccess: () => {
      setMergeUndo(null);
      void utils.entity.detail.invalidate({ kind: 'person', id: detail.id });
      router.refresh();
    },
  });

  // D3: visible enrichment. Refetch only when facts actually landed — a
  // no_provider / failed / empty answer leaves the card on its honest
  // not-enriched state with the retry still one tap away.
  const enrich = trpc.entity.enrich.useMutation({
    onSuccess: (res) => {
      if (res.ok && res.wroteFactKeys.length > 0) {
        void utils.entity.detail.invalidate({ kind: 'person', id: detail.id });
        router.refresh();
      }
    },
  });
  const enrichState = {
    pending: enrich.isPending,
    providerConfigured: detail.webSearchConfigured ?? true,
    lastReason:
      enrichReasonFromResult(enrich.data as EnrichResult | undefined) ??
      (enrich.error ? ('failed' as const) : null),
  };

  const subText = React.useMemo(
    () => [detail.sub.role, detail.sub.companyName].filter(Boolean).join(' · ') || 'no role yet',
    [detail.sub.role, detail.sub.companyName],
  );

  const tags = React.useMemo(() => {
    const parsed = parseImportSource(detail.importSource);
    if (parsed?.kind === 'linkedin') return ['linkedin'];
    if (parsed?.kind === 'vcard') return ['vcard'];
    if (parsed?.kind === 'device') return ['device'];
    if (detail.importSource && detail.importSource !== 'voice-capture') return ['imported'];
    return undefined;
  }, [detail.importSource]);

  return (
    <div className="surface-split">
      <PersonListRail />
      <div className="surface-primary">
        <EntityDetailScaffold
          kind="person"
          hero={<PersonAvatar size={72} name={detail.name} seed={detail.id} />}
          eyebrow="◉ person"
          name={detail.name}
          sub={subText}
          tags={tags}
          primaryCta={{
            label: 'draft check-in →',
            pending: createDraft.isPending,
            onClick: () =>
              createDraft.mutate({
                kind: 'email',
                intent: 'check-in',
                targetEntityId: detail.id,
                contextName: detail.sub.companyName ?? undefined,
              }),
          }}
          ghostCta={{
            label: 'edit',
            title: 'edit person — coming later',
            disabled: true,
          }}
          stats={detail.stats}
          captures={detail.captures}
          followups={detail.followups}
          related={detail.related}
          topics={detail.topics}
          publicProfile={detail.publicProfile}
          enrich={enrichState}
          onEnrich={() => enrich.mutate({ entityId: detail.id })}
          possibleMatches={detail.possibleMatches}
          onMergePossibleMatch={(sourceId) =>
            merge.mutate({ sourceId, targetId: detail.id })
          }
          mergePendingId={mergePendingId}
          mergeUndo={mergeUndo}
          onUndoMerge={() => {
            if (mergeUndo) undoMerge.mutate({ mergeId: mergeUndo.mergeId });
          }}
          entityId={detail.id}
        />
      </div>
    </div>
  );
}
