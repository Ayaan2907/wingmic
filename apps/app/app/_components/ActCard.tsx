'use client';

/**
 * ActCard — shared agent-draft card (home + /acts).
 *
 * Permission-first send: mailto for email/intro, .ics download for
 * meeting/reminder, mark-done for todo. Requires `act.id` from acts.list.
 */

import * as React from 'react';
import { buildIcs, mailtoHref } from '@/lib/acts/mapAction';
import { PersonAvatar } from './entity/EntityAvatar';

const accent = '#FFC452';

export type PendingAct = {
  /** DB id when loaded from acts.list — enables send mutations. */
  id?: string;
  kind: string;
  glyph: string;
  name: string;
  why: string;
  conf: number;
  accent: 'amber' | 'blue' | 'violet';
  color: string;
  /** Underlying extractor/db kind for CTA routing. */
  actionKind?: 'reminder' | 'email' | 'meeting' | 'todo' | 'intro';
  subject?: string | null;
  whenHint?: string | null;
  body?: string;
};

export function ActCard({
  act: a,
  onSent,
}: {
  act: PendingAct;
  /** Called after a successful permission-first send (mailto / ics / done). */
  onSent?: (id: string) => void;
}) {
  const canSend = Boolean(a.id);

  function handleSend() {
    if (!a.id) return;
    const actionKind = a.actionKind ?? 'todo';
    const body = a.body ?? a.why;
    switch (actionKind) {
      case 'email':
      case 'intro': {
        window.location.href = mailtoHref({
          subject: a.subject ?? `wingmic · ${a.kind}`,
          body,
        });
        onSent?.(a.id);
        return;
      }
      case 'meeting':
      case 'reminder': {
        const ics = buildIcs({
          title: a.subject ?? a.name,
          description: body,
          whenHint: a.whenHint,
        });
        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `wingmic-${a.kind}.ics`;
        link.click();
        URL.revokeObjectURL(url);
        onSent?.(a.id);
        return;
      }
      case 'todo': {
        onSent?.(a.id);
        return;
      }
      default: {
        const _exhaustive: never = actionKind;
        return _exhaustive;
      }
    }
  }

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 14,
        background: 'var(--surface-1, rgba(255,255,255,0.02))',
        border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span aria-hidden="true" style={{ display: 'inline-flex' }}>
        <PersonAvatar name={a.name} accent={a.accent} size={36} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 2 }}>
          <span
            className="mono"
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              color: a.color,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            {a.glyph} {a.kind}
          </span>
          <span className="mono" style={{ fontSize: 9.5, color: 'var(--text-40)' }}>
            · {a.conf}%
          </span>
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {a.name}
        </div>
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.3,
            color: 'var(--text-55)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {a.why}
        </div>
      </div>
      <button
        type="button"
        disabled={!canSend}
        title={canSend ? `send ${a.kind}` : 'no draft id'}
        aria-label={
          canSend ? `send ${a.kind} for ${a.name}` : `send ${a.kind} for ${a.name} — unavailable`
        }
        onClick={handleSend}
        style={{
          padding: '7px 11px',
          borderRadius: 8,
          background: accent,
          color: '#000',
          border: '1.5px solid #000',
          boxShadow: '2px 2px 0 #000',
          font: '700 11px Inter, system-ui, sans-serif',
          cursor: canSend ? 'pointer' : 'not-allowed',
          opacity: canSend ? 1 : 0.85,
          flexShrink: 0,
        }}
      >
        send →
      </button>
    </div>
  );
}
