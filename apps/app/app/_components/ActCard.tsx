'use client';

/**
 * ActCard — shared agent-draft card (home + /acts).
 *
 * Permission-first send: mailto for email/intro, .ics download for
 * meeting/reminder, mark-done for todo. Requires `act.id` from acts.list.
 * Supports snooze / dismiss / inline edit.
 */

import * as React from 'react';
import { buildIcs, mailtoHref } from '@/lib/acts/mapAction';
import { chooseActChannel, type ActChannel } from '@/lib/acts/chooseActChannel';
import { linkedinProfileHref } from '@/lib/acts/linkedinHref';
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
  /** How this draft should be sent / completed. */
  channel?: ActChannel;
  subject?: string | null;
  whenHint?: string | null;
  body?: string;
  /** Target person email when known from entity facts — required for mailto send. */
  targetEmail?: string | null;
  /** Public LinkedIn URL when known — used for linkedin-note send. */
  targetLinkedin?: string | null;
  status?: 'drafted' | 'snoozed' | 'sent' | 'dismissed';
};

export function ActCard({
  act: a,
  onSent,
  onSnooze,
  onDismiss,
  onSaveEdit,
  sendError,
}: {
  act: PendingAct;
  /** Called after a successful permission-first send (mailto / ics / done). */
  onSent?: (id: string) => void;
  onSnooze?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onSaveEdit?: (
    id: string,
    patch: { body: string; subject: string | null },
  ) => void | boolean | Promise<void | boolean>;
  /** Shown when markSent fails after a todo send. */
  sendError?: string | null;
}) {
  const canSend = Boolean(a.id);
  const actionKind = a.actionKind ?? 'todo';
  const channel: ActChannel =
    a.channel ??
    chooseActChannel({
      kind: actionKind,
      hasEmail: Boolean(a.targetEmail?.trim()),
      hasLinkedin: Boolean(a.targetLinkedin?.trim()),
    });
  const needsEmail = channel === 'email' || channel === 'intro';
  const hasEmail = Boolean(a.targetEmail?.trim());
  const emailBlocked = needsEmail && !hasEmail;
  const draftBody = a.body ?? a.why;
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [copyError, setCopyError] = React.useState<string | null>(null);
  const [editBody, setEditBody] = React.useState(a.body ?? a.why);
  const [editSubject, setEditSubject] = React.useState(a.subject ?? '');

  React.useEffect(() => {
    setEditBody(a.body ?? a.why);
    setEditSubject(a.subject ?? '');
    setEditError(null);
  }, [a.body, a.why, a.subject, a.id]);

  function handleSend() {
    if (!a.id) return;
    const body = draftBody;
    switch (channel) {
      case 'email':
      case 'intro': {
        const to = a.targetEmail?.trim();
        if (!to) return;
        const href = mailtoHref({
          to,
          subject: a.subject ?? `wingmic · ${a.kind}`,
          body,
        });
        window.location.href = href;
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
        setTimeout(() => URL.revokeObjectURL(url), 0);
        return;
      }
      case 'linkedin': {
        const href = linkedinProfileHref(a.targetLinkedin);
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          void navigator.clipboard.writeText(body).catch(() => {
            setCopyError('could not copy — select the draft');
          });
        }
        if (href) window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }
      case 'memo': {
        onSent?.(a.id);
        return;
      }
      default: {
        const _exhaustive: never = channel;
        return _exhaustive;
      }
    }
  }

  const sendLabel =
    channel === 'linkedin'
      ? 'copy note →'
      : channel === 'memo'
        ? 'mark done →'
        : channel === 'reminder' || channel === 'meeting'
          ? 'add to cal →'
          : 'send →';

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 14,
        background: 'var(--surface-1, rgba(255,255,255,0.02))',
        border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
      data-testid="act-card"
      data-act-status={a.status ?? 'drafted'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
            {a.status === 'snoozed' ? (
              <span className="mono" style={{ fontSize: 9.5, color: 'var(--text-40)' }}>
                · snoozed
              </span>
            ) : null}
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
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 4,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            disabled={!canSend || emailBlocked}
            title={
              emailBlocked
                ? 'no email on file for this person'
                : canSend
                  ? `send ${a.kind}`
                  : 'no draft id'
            }
            aria-label={
              emailBlocked
                ? `${sendLabel} for ${a.name} — no email on file`
                : canSend
                  ? `${sendLabel.replace(' →', '')} ${a.kind} for ${a.name}`
                  : `${sendLabel.replace(' →', '')} ${a.kind} for ${a.name} — unavailable`
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
              cursor: canSend && !emailBlocked ? 'pointer' : 'not-allowed',
              opacity: canSend && !emailBlocked ? 1 : 0.85,
            }}
          >
            {sendLabel}
          </button>
          {sendError || copyError ? (
            <span
              className="mono"
              role="alert"
              style={{ fontSize: 9, color: '#FF6B6B', letterSpacing: 0.3, textAlign: 'right' }}
            >
              {sendError || copyError}
            </span>
          ) : null}
        </div>
      </div>

      {!editing && (a.subject || draftBody) ? (
        <div
          data-testid="act-draft"
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {a.subject ? (
            <div
              className="mono"
              data-testid="act-subject"
              style={{
                fontSize: 11,
                color: 'var(--text-70, var(--text-55))',
                paddingBottom: 6,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {a.subject}
            </div>
          ) : null}
          <div
            data-testid="act-body"
            className="mono"
            style={{
              fontSize: 11,
              lineHeight: 1.55,
              color: 'var(--ink)',
              whiteSpace: 'pre-wrap',
              maxHeight: 220,
              overflow: 'auto',
            }}
          >
            {draftBody}
          </div>
          {a.whenHint ? (
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-40)' }}>
              when · {a.whenHint}
            </div>
          ) : a.body && a.why ? (
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-40)' }}>
              {a.why}
            </div>
          ) : null}
        </div>
      ) : null}

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="act-edit">
          <input
            aria-label="edit subject"
            value={editSubject}
            onChange={(e) => setEditSubject(e.target.value)}
            placeholder="subject"
            className="mono"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--border-mid)',
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              fontSize: 12,
            }}
          />
          <textarea
            aria-label="edit body"
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--border-mid)',
              background: 'var(--surface-2)',
              color: 'var(--ink)',
              fontSize: 13,
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="mono"
              onClick={() => {
                setEditBody(a.body ?? a.why);
                setEditSubject(a.subject ?? '');
                setEditError(null);
                setEditing(false);
              }}
              style={{
                fontSize: 11,
                background: 'none',
                border: 'none',
                color: 'var(--text-55)',
                cursor: 'pointer',
              }}
            >
              cancel
            </button>
            <button
              type="button"
              className="mono"
              disabled={!a.id || !editBody.trim() || saving}
              onClick={() => {
                if (!a.id || !editBody.trim() || saving) return;
                void (async () => {
                  setSaving(true);
                  setEditError(null);
                  try {
                    const result = await onSaveEdit?.(a.id!, {
                      body: editBody.trim(),
                      subject: editSubject.trim() ? editSubject.trim() : null,
                    });
                    if (result === false) {
                      setEditError('could not save — try again');
                      return;
                    }
                    setEditing(false);
                  } catch {
                    setEditError('could not save — try again');
                  } finally {
                    setSaving(false);
                  }
                })();
              }}
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '6px 10px',
                borderRadius: 8,
                border: '1.5px solid #000',
                background: accent,
                color: '#000',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'saving…' : 'save'}
            </button>
          </div>
          {editError ? (
            <span
              className="mono"
              role="alert"
              data-testid="act-edit-error"
              style={{ fontSize: 9, color: '#FF6B6B', letterSpacing: 0.3 }}
            >
              {editError}
            </span>
          ) : null}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 10 }}>
          {a.id && onSaveEdit ? (
            <button
              type="button"
              className="mono"
              data-testid="act-edit-toggle"
              onClick={() => setEditing(true)}
              style={{
                fontSize: 10,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                background: 'none',
                border: 'none',
                color: 'var(--text-55)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              edit
            </button>
          ) : null}
          {a.id && onSnooze ? (
            <button
              type="button"
              className="mono"
              data-testid="act-snooze"
              onClick={() => onSnooze(a.id!)}
              style={{
                fontSize: 10,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                background: 'none',
                border: 'none',
                color: 'var(--text-55)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              snooze 24h
            </button>
          ) : null}
          {a.id && onDismiss ? (
            <button
              type="button"
              className="mono"
              data-testid="act-dismiss"
              onClick={() => onDismiss(a.id!)}
              style={{
                fontSize: 10,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                background: 'none',
                border: 'none',
                color: 'var(--text-55)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              dismiss
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
