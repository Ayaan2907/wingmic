'use client';

// ChatThread — chat-thread render surface, extracted from CaptureClient (PR β₁-A).
//
// Owns: ThreadView + all message-rendering sub-components (PhantomBubble,
// MessageBubble, BubbleHeader, BubbleFooter, Skeleton, FailedBubble,
// EmptyHero, InlineLink, PasteInline, GraphCard, PersonPill, TagPill,
// ActionCard, UndoChip, failedKind, failedActions, LevelMeter).
//
// NEW for β₁: the message list is wrapped in a dimming layer — opacity 0.4 +
// pointer-events: none when the recorder is hot. The phantom bubble (which
// renders the live in-progress capture) sits OUTSIDE that wrapper, so it
// stays at full opacity. design/v2/proto-screens-a.jsx §ScreenChatRecording
// is the reference.

import { useAudioRecorder } from '@/app/capture/_components/useAudioRecorder';
import type {
  ThreadMessage,
  GraphResult,
  FailureCode,
} from './types';
import { accent, coral, third, violet, blue } from './tokens';

function fmtMs(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

interface ThreadViewProps {
  messages: ThreadMessage[];
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
  onPaste: (id: string) => void;
  onDelete: (id: string) => void;
  pasteOpenForId: string | null;
  pasteDraft: string;
  setPasteDraft: (v: string) => void;
  onPasteSubmit: (id: string) => void;
  onPasteCancel: () => void;
  threadEndRef: React.RefObject<HTMLDivElement | null>;
  recorder: ReturnType<typeof useAudioRecorder>;
}

export function ChatThread(props: ThreadViewProps) {
  const { messages, recorder, threadEndRef } = props;
  const recording =
    recorder.status === 'recording' ||
    recorder.status === 'lock_armed' ||
    recorder.status === 'cancel_armed' ||
    recorder.status === 'locked';

  // β₁ thread-dimming: the message list dims while the mic is hot. Phantom
  // bubble sits OUTSIDE the dimmed wrapper so live transcription stays at
  // full opacity. Transition timed to ~motion-default-fast (180ms ease-out).
  const dimStyle: React.CSSProperties = {
    opacity: recording ? 0.4 : 1,
    pointerEvents: recording ? 'none' : 'auto',
    transition: 'opacity 180ms ease-out',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 16px 200px',
        maxWidth: 640,
        width: '100%',
        margin: '0 auto',
        gap: 18,
      }}
    >
      <div style={dimStyle}>
        {messages.length === 0 && !recording && <EmptyHero />}

        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            onRetry={() => props.onRetry(m.id)}
            onDiscard={() => props.onDiscard(m.id)}
            onPaste={() => props.onPaste(m.id)}
            onDelete={() => props.onDelete(m.id)}
            pasteOpen={props.pasteOpenForId === m.id}
            pasteDraft={props.pasteDraft}
            setPasteDraft={props.setPasteDraft}
            onPasteSubmit={() => props.onPasteSubmit(m.id)}
            onPasteCancel={props.onPasteCancel}
          />
        ))}
      </div>

      {recording && <PhantomBubble recorder={recorder} />}

      <div ref={threadEndRef} />
    </div>
  );
}

function EmptyHero() {
  return (
    <div style={{ padding: '60px 8px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        className="mono"
        style={{ fontSize: 11, letterSpacing: 2, color: accent, textTransform: 'uppercase' }}
      >
        start here
      </div>
      <h1
        style={{
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
        }}
      >
        hold the button.{' '}
        <span className="serif" style={{ fontStyle: 'italic', color: accent, fontWeight: 400 }}>
          talk for thirty seconds about someone you just met.
        </span>
      </h1>
      <p style={{ fontSize: 15, color: 'var(--text-70)', lineHeight: 1.55, maxWidth: 520 }}>
        i&apos;ll sort the names, companies, follow-ups. you&apos;ll see it land below.
      </p>
      <p style={{ fontSize: 14.5, color: 'var(--text-40)', lineHeight: 1.55 }}>
        short is fine. ten seconds counts.
      </p>
    </div>
  );
}

// ─── Phantom (recording-in-progress) bubble ─────────────────────────────

function PhantomBubble({ recorder }: { recorder: ReturnType<typeof useAudioRecorder> }) {
  const sec = (recorder.duration / 1000).toFixed(1);
  return (
    <div
      style={{
        alignSelf: 'flex-end',
        maxWidth: '86%',
        padding: '14px 16px',
        borderRadius: 14,
        background: 'var(--surface-2)',
        border: `1.5px solid ${accent}50`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        animation: 'wm-rise 0.4s ease-out',
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 10,
          color: accent,
          letterSpacing: 2,
          textTransform: 'uppercase',
          display: 'flex',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: 999,
            background: coral,
            animation: 'wm-pulse-d 1.5s ease-in-out infinite',
          }}
        />
        rec · {sec}s
      </div>
      <LevelMeter level={recorder.level} />
    </div>
  );
}

function LevelMeter({ level }: { level: number[] }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="recording level"
      style={{
        display: 'flex',
        gap: 3,
        alignItems: 'center',
        height: 40,
      }}
    >
      {level.map((v, i) => (
        <div
          key={i}
          aria-hidden="true"
          style={{
            width: 3,
            height: Math.max(4, Math.round(4 + v * 34)),
            background: accent,
            borderRadius: 2,
            transition: 'height 0.12s ease-out',
          }}
        />
      ))}
    </div>
  );
}

// ─── Message bubble ──────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: ThreadMessage;
  onRetry: () => void;
  onDiscard: () => void;
  onPaste: () => void;
  onDelete: () => void;
  pasteOpen: boolean;
  pasteDraft: string;
  setPasteDraft: (v: string) => void;
  onPasteSubmit: () => void;
  onPasteCancel: () => void;
}

function MessageBubble(props: MessageBubbleProps) {
  const { message: m } = props;

  if (m.status === 'failed') return <FailedBubble {...props} />;

  const showSkeleton = m.status === 'uploading' || m.status === 'transcribing';
  const showLinkSweep = m.status === 'linking';
  const isCommitted = m.status === 'committed';

  return (
    <div style={{ alignSelf: 'flex-end', maxWidth: '92%', width: '100%' }}>
      <div
        style={{
          alignSelf: 'flex-end',
          padding: '14px 16px',
          borderRadius: '18px 18px 4px 18px',
          background: accent,
          color: '#fff',
          border: '1.5px solid #000',
          boxShadow: '3px 3px 0 #000',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          position: 'relative',
        }}
      >
        <BubbleHeader m={m} onDelete={props.onDelete} />
        {showSkeleton ? (
          <Skeleton />
        ) : m.transcript ? (
          <p
            style={{
              fontSize: 15.5,
              lineHeight: 1.55,
              color: '#fff',
              whiteSpace: 'pre-wrap',
              margin: 0,
            }}
          >
            {m.transcript}
          </p>
        ) : null}
        {showLinkSweep && (
          <div
            aria-hidden="true"
            style={{
              height: 2,
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)',
              backgroundSize: '200% 100%',
              borderRadius: 2,
              animation: 'wm-shimmer 1.8s linear infinite',
            }}
          />
        )}
        <BubbleFooter m={m} />
      </div>
      {isCommitted && m.graphResult && <GraphCard message={m} result={m.graphResult} />}
    </div>
  );
}

function BubbleHeader({ m, onDelete }: { m: ThreadMessage; onDelete: () => void }) {
  const time = m.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  let meta = '';
  if (m.status === 'uploading') meta = '↑ uploading';
  else if (m.status === 'transcribing') {
    const elapsed = m.transcribingStartedAt
      ? ((performance.now() - m.transcribingStartedAt) / 1000).toFixed(1)
      : '0.0';
    meta = `· transcribing ${elapsed}s`;
  } else if (m.status === 'linking') meta = '· linking entities';
  else if (m.status === 'committed') meta = `· ${time}`;

  return (
    <div
      className="mono"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 10,
        color: 'rgba(255,255,255,0.75)',
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      <span>{m.status === 'committed' ? time : meta}</span>
      {m.status === 'committed' && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="delete memo"
          style={{
            background: 'transparent',
            color: 'rgba(255,255,255,0.75)',
            border: 'none',
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          ⋯
        </button>
      )}
    </div>
  );
}

function BubbleFooter({ m }: { m: ThreadMessage }) {
  const meta = 'rgba(255,255,255,0.65)';
  if (m.status === 'uploading' || m.status === 'transcribing') {
    const kb = m.audioBlob ? Math.round(m.audioBlob.size / 1024) : 0;
    const dur = (m.duration / 1000).toFixed(1);
    return (
      <div className="mono" style={{ fontSize: 10, color: meta }}>
        {kb}kb · {dur}s
      </div>
    );
  }
  if (m.status === 'linking') {
    return (
      <div className="mono" style={{ fontSize: 10, color: meta }}>
        transcribed in {fmtMs(m.transcribeMs)} · committing...
      </div>
    );
  }
  if (m.status === 'committed') {
    const g = m.graphResult;
    const newN = g?.newEntities ?? 0;
    const linkN = g?.matchedEntities ?? 0;
    const isEmpty =
      g != null &&
      g.extracted.persons.length === 0 &&
      g.extracted.companies.length === 0 &&
      g.extracted.events.length === 0 &&
      g.extracted.actions.length === 0;
    if (isEmpty) {
      return (
        <div className="mono" style={{ fontSize: 10, color: meta }}>
          no entities found · {fmtMs(m.transcribeMs)} transcribe · {fmtMs(m.commitMs)} commit
        </div>
      );
    }
    // Past-commit bubbles seeded from the server prefetch have no
    // graphResult and no timing data — skip the meta row entirely.
    if (g == null) return null;
    return (
      <div className="mono" style={{ fontSize: 10, color: meta }}>
        {fmtMs(m.transcribeMs)} transcribe · {fmtMs(m.commitMs)} commit · {newN} new ·{' '}
        {linkN} linked
      </div>
    );
  }
  return null;
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[0.85, 0.7, 0.55].map((w, i) => (
        <div
          key={i}
          style={{
            width: `${w * 100}%`,
            height: 10,
            borderRadius: 6,
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 100%)',
            backgroundSize: '200% 100%',
            animation: 'wm-shimmer 1.6s linear infinite',
            animationDelay: `${i * 120}ms`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Failed bubble ───────────────────────────────────────────────────────

function FailedBubble(props: MessageBubbleProps) {
  const { message: m } = props;
  const code = m.error?.code ?? 'unknown_error';

  const kind = failedKind(code);
  const actions = failedActions(code);

  return (
    <div
      role="alert"
      style={{
        alignSelf: 'flex-end',
        maxWidth: '92%',
        padding: '14px 16px',
        borderRadius: 14,
        background: 'rgba(255,107,107,0.06)',
        border: '1px solid rgba(255,107,107,0.25)',
        borderLeft: `3px solid ${coral}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 10,
          color: coral,
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}
      >
        ! failed · {kind}
      </div>
      <p
        style={{
          fontSize: 14.5,
          lineHeight: 1.55,
          color: 'var(--text-85)',
          margin: 0,
        }}
      >
        {m.error?.message ?? 'something broke.'}
      </p>
      {props.pasteOpen ? (
        <PasteInline
          draft={props.pasteDraft}
          setDraft={props.setPasteDraft}
          onSubmit={props.onPasteSubmit}
          onCancel={props.onPasteCancel}
        />
      ) : (
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--text-70)',
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {actions.includes('retry') && (
            <InlineLink onClick={props.onRetry}>↻ retry</InlineLink>
          )}
          {actions.includes('retry-mic') && (
            <InlineLink onClick={props.onRetry}>↻ retry mic</InlineLink>
          )}
          {actions.includes('re-record') && (
            <InlineLink onClick={props.onRetry}>↻ re-record</InlineLink>
          )}
          {actions.includes('re-upload') && (
            <InlineLink onClick={props.onRetry}>↻ re-upload</InlineLink>
          )}
          {actions.includes('paste') && (
            <InlineLink onClick={props.onPaste}>✎ paste instead</InlineLink>
          )}
          {actions.includes('type') && (
            <InlineLink onClick={props.onPaste}>✎ type instead</InlineLink>
          )}
          {actions.includes('discard') && (
            <InlineLink onClick={props.onDiscard}>× discard</InlineLink>
          )}
          {actions.includes('start-over') && (
            <InlineLink onClick={props.onDiscard}>× start over</InlineLink>
          )}
        </div>
      )}
    </div>
  );
}

function failedKind(code: FailureCode): string {
  switch (code) {
    case 'provider_error':
      return 'transcribe';
    case 'rate_limited':
      return 'rate-limited';
    case 'too_big':
      return 'too big';
    case 'too_long':
      return 'too long';
    case 'transcript_empty':
      return 'silent';
    case 'NotAllowedError':
      return 'mic';
    case 'network':
      return 'upload';
    case 'commit_failed':
      return 'commit';
    default:
      return 'unknown';
  }
}

type FailedAction =
  | 'retry'
  | 'retry-mic'
  | 're-record'
  | 're-upload'
  | 'paste'
  | 'type'
  | 'discard'
  | 'start-over';

function failedActions(code: FailureCode): FailedAction[] {
  switch (code) {
    case 'provider_error':
    case 'rate_limited':
      return ['retry', 'paste', 'discard'];
    case 'too_big':
    case 'too_long':
      return ['re-record', 'paste', 'discard'];
    case 'network':
      return ['re-upload', 'start-over'];
    case 'transcript_empty':
      return ['retry', 'type'];
    case 'NotAllowedError':
      return ['retry-mic', 'type'];
    case 'commit_failed':
      return ['retry', 'paste', 'discard'];
    default:
      return ['retry', 'discard'];
  }
}

function InlineLink({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        color: accent,
        border: 'none',
        cursor: 'pointer',
        font: 'inherit',
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

function PasteInline({
  draft,
  setDraft,
  onSubmit,
  onCancel,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="type the memo. entities get sorted on commit."
        rows={4}
        style={{
          width: '100%',
          padding: '12px 14px',
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--border-soft)',
          borderRadius: 10,
          color: 'var(--ink)',
          font: '14.5px Inter, system-ui, sans-serif',
          resize: 'vertical',
          outline: 'none',
        }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!draft.trim()}
          style={{
            padding: '8px 14px',
            borderRadius: 10,
            background: accent,
            color: '#000',
            fontWeight: 700,
            border: '1.5px solid #000',
            boxShadow: '3px 3px 0 #000',
            cursor: 'pointer',
            opacity: draft.trim() ? 1 : 0.5,
            font: '700 12.5px Inter, system-ui, sans-serif',
          }}
        >
          commit →
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '8px 14px',
            borderRadius: 10,
            background: 'transparent',
            color: 'var(--ink)',
            border: '1.5px solid var(--border-mid)',
            cursor: 'pointer',
            font: '600 12.5px Inter, system-ui, sans-serif',
          }}
        >
          cancel
        </button>
      </div>
    </div>
  );
}

// ─── Graph card ──────────────────────────────────────────────────────────

function GraphCard({ message, result }: { message: ThreadMessage; result: GraphResult }) {
  const { extracted } = result;
  const isEmpty =
    extracted.persons.length === 0 &&
    extracted.companies.length === 0 &&
    extracted.events.length === 0 &&
    extracted.actions.length === 0;

  if (isEmpty) return null;

  return (
    <div
      style={{
        marginTop: 8,
        padding: 14,
        borderRadius: 14,
        background: 'var(--surface-1)',
        border: '1px solid var(--border-soft)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        animation: 'wm-rise 0.4s ease-out',
      }}
    >
      {extracted.persons.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            className="mono"
            style={{ fontSize: 9.5, color: 'var(--text-40)', letterSpacing: 2, textTransform: 'uppercase' }}
          >
            people
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {extracted.persons.map((p, i) => (
              <PersonPill key={`${p.name}-${i}`} person={p} />
            ))}
          </div>
        </div>
      )}

      {(extracted.companies.length > 0 || extracted.events.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {extracted.companies.map((c) => (
            <TagPill key={`co-${c.name}`} color={blue}>
              {c.name}
            </TagPill>
          ))}
          {extracted.events.map((e) => (
            <TagPill key={`ev-${e.name}`} color={third}>
              {e.name}
            </TagPill>
          ))}
        </div>
      )}

      {extracted.actions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            className="mono"
            style={{ fontSize: 9.5, color: 'var(--text-40)', letterSpacing: 2, textTransform: 'uppercase' }}
          >
            follow-ups
          </div>
          {extracted.actions.slice(0, 2).map((a, i) => (
            <ActionCard key={i} action={a} />
          ))}
          {extracted.actions.length > 2 && (
            <div className="mono" style={{ fontSize: 11, color: accent }}>
              +{extracted.actions.length - 2} more →
            </div>
          )}
        </div>
      )}

      {extracted.topics.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {extracted.topics.map((t) => (
            <TagPill key={t} color={violet}>
              {t}
            </TagPill>
          ))}
        </div>
      )}

      <div
        className="mono"
        style={{
          fontSize: 9.5,
          color: 'var(--text-30)',
          letterSpacing: 1,
          paddingTop: 6,
          borderTop: '1px solid var(--border-soft)',
        }}
      >
        {fmtMs(message.transcribeMs)} transcribe · {fmtMs(message.commitMs)} commit ·{' '}
        {result.newEntities} new · {result.matchedEntities} linked
      </div>
    </div>
  );
}

function PersonPill({
  person,
}: {
  person: {
    name: string;
    role: string | null;
    companyHint: string | null;
    topics: string[];
  };
}) {
  const monogram = person.name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <a
      href={`/entity/${encodeURIComponent(person.name)}`}
      style={{
        display: 'flex',
        gap: 10,
        padding: '8px 12px 8px 8px',
        borderRadius: 999,
        background: 'var(--surface-2)',
        border: '1px solid var(--border-soft)',
        borderLeft: `2px solid ${accent}`,
        textDecoration: 'none',
        color: 'inherit',
        alignItems: 'center',
        minHeight: 32,
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          background: accent,
          color: '#000',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 11,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {monogram}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.2 }}>{person.name}</span>
        {(person.role || person.companyHint) && (
          <span style={{ fontSize: 11, color: 'var(--text-55)' }}>
            {person.role}
            {person.role && person.companyHint && ' · '}
            {person.companyHint && <span style={{ color: blue }}>{person.companyHint}</span>}
          </span>
        )}
      </span>
    </a>
  );
}

function TagPill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="mono"
      style={{
        padding: '3px 9px',
        borderRadius: 999,
        background: `${color}1f`,
        color,
        border: `1px solid ${color}40`,
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

function ActionCard({
  action,
}: {
  action: { kind: string; body: string; whenHint: string | null };
}) {
  const glyph =
    action.kind === 'reminder'
      ? '◷'
      : action.kind === 'intro'
        ? '⇌'
        : action.kind === 'check-in'
          ? '↗'
          : '→';
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 10,
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid var(--border-soft)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div
        className="mono"
        style={{ fontSize: 10, color: accent, letterSpacing: 1, textTransform: 'uppercase' }}
      >
        {glyph} {action.kind}
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-85)' }}>{action.body}</div>
      {action.whenHint && (
        <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-40)' }}>
          due: {action.whenHint}
        </div>
      )}
    </div>
  );
}

// ─── Undo chip ──────────────────────────────────────────────────────────

export function UndoChip({
  queue,
  onUndo,
}: {
  queue: { id: string; until: number }[];
  onUndo: (id: string) => void;
}) {
  const latest = queue[queue.length - 1];
  if (!latest) return null;
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 180,
        transform: 'translateX(-50%)',
        padding: '8px 14px',
        background: 'rgba(255,107,107,0.12)',
        border: `1px solid ${coral}40`,
        borderRadius: 999,
        color: 'var(--ink)',
        fontSize: 12,
        zIndex: 60,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}
      className="mono"
    >
      memo removed ·{' '}
      <button
        type="button"
        onClick={() => onUndo(latest.id)}
        style={{
          color: accent,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        ↶ undo
      </button>
    </div>
  );
}
