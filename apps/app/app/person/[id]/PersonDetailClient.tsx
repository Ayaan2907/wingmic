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
  possibleMatches?: EntityPossibleMatch[];
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

  const subText =
    [detail.sub.role, detail.sub.companyName].filter(Boolean).join(' · ') || 'no role yet';

  const parsed = parseImportSource(detail.importSource);
  const tags =
    parsed?.kind === 'linkedin'
      ? ['linkedin']
      : parsed?.kind === 'vcard'
        ? ['vcard']
        : parsed?.kind === 'device'
          ? ['device']
          : detail.importSource && detail.importSource !== 'voice-capture'
            ? ['imported']
            : undefined;

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
