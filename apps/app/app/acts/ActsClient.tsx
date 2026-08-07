'use client';

/**
 * ActsClient — /acts inbox.
 *
 * Lists drafted follow-ups from capture extraction. Send is permission-first
 * (mailto / .ics / mark done) via ActCard; status updates through acts.markSent.
 */

import * as React from 'react';
import { trpc } from '@/lib/trpc/client';
import { ActCard } from '@/app/_components/ActCard';

const accent = '#FFC452';

export function ActsClient() {
  const utils = trpc.useUtils();
  const [markErrors, setMarkErrors] = React.useState<Record<string, string>>({});
  const { data, isLoading, isError, refetch } = trpc.acts.list.useQuery({ limit: 50 });
  const markSent = trpc.acts.markSent.useMutation({
    onSuccess: (_data, vars) => {
      setMarkErrors((prev) => {
        if (!prev[vars.id]) return prev;
        const next = { ...prev };
        delete next[vars.id];
        return next;
      });
      void utils.acts.list.invalidate();
    },
    onError: (_err, vars) => {
      setMarkErrors((prev) => ({
        ...prev,
        [vars.id]: 'could not mark done — tap send again',
      }));
    },
  });

  const acts = data?.acts ?? [];

  function handleMarkSent(id: string) {
    markSent.mutate({ id });
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-page)',
        color: 'var(--ink)',
      }}
      data-screen="acts"
    >
      <header
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          background: 'rgba(10,10,10,0.85)',
          backdropFilter: 'blur(20px)',
          zIndex: 30,
          gap: 12,
        }}
      >
        <span
          className="mono"
          style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.5, color: 'var(--ink)' }}
        >
          acts
        </span>
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: 1,
            color: 'var(--text-40)',
            textTransform: 'uppercase',
          }}
        >
          {isLoading ? '…' : `${acts.length} draft${acts.length === 1 ? '' : 's'}`}
        </span>
      </header>

      <section
        style={{
          padding: '20px 20px 0',
          maxWidth: 640,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <div
          data-testid="acts-banner"
          className="mono"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 12,
            marginBottom: 20,
            fontSize: 12,
            lineHeight: 1.45,
            color: 'var(--text-85)',
            background: `linear-gradient(90deg, ${accent}1a, transparent)`,
            border: `1px solid ${accent}4d`,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: accent,
              flexShrink: 0,
            }}
          />
          <span>
            <span style={{ color: accent, fontWeight: 700 }}>acts</span> drafts from your
            captures — review, then send yourself (mailto / calendar). nothing auto-sends.
          </span>
        </div>

        {isLoading ? (
          <p className="mono" style={{ fontSize: 12, color: 'var(--text-40)' }}>
            loading drafts…
          </p>
        ) : isError ? (
          <div
            data-testid="acts-error"
            style={{
              padding: 16,
              borderRadius: 14,
              border: '1px solid var(--border-soft)',
              background: 'var(--surface-1)',
            }}
          >
            <p className="mono" style={{ fontSize: 12, color: 'var(--text-55)', margin: 0 }}>
              could not load drafts.
            </p>
            <button
              type="button"
              className="mono"
              onClick={() => void refetch()}
              style={{
                marginTop: 8,
                fontSize: 11,
                color: accent,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              retry →
            </button>
          </div>
        ) : acts.length === 0 ? (
          <div
            data-testid="acts-empty"
            style={{
              padding: 16,
              borderRadius: 14,
              background: 'var(--surface-1, rgba(255,255,255,0.02))',
              border: '1px dashed var(--border-soft, rgba(255,255,255,0.06))',
              color: 'var(--text-55)',
              fontSize: 13.5,
              lineHeight: 1.55,
            }}
          >
            no drafts yet — capture a memo that mentions a follow-up, intro, or meeting.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="acts-list">
            {acts.map((a) => (
              <ActCard
                key={a.id}
                act={a}
                sendError={markErrors[a.id ?? ''] ?? null}
                onSent={handleMarkSent}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
