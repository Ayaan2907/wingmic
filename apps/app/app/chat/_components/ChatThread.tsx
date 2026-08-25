'use client';

// ChatThread — chat-thread render surface (PR β₁-D rewrite).
//
// Consumes useCapture() for messages + recorder state. The thread dims
// (opacity 0.4) while the mic is hot; the live phantom bubble is rendered
// by the global RecordingOverlay (in layout.tsx), not in-thread, so the
// dimming applies cleanly to the message list without needing an inner
// "stays full opacity" carve-out.

import Link from 'next/link';
import { memo } from 'react';
import { useCapture } from '@/app/_components/CaptureProvider';
import { AskExchange } from './AskPrimitives';
import { PersonCaptureCard } from './PersonCaptureCard';
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

export function ChatThread() {
  const {
    recorder,
    visibleMessages,
    pasteOpenForId,
    pasteDraft,
    setPasteDraft,
    retryBubble,
    discardBubble,
    openPaste,
    closePaste,
    submitPaste,
    softDelete,
    saveAskAsMemo,
  } = useCapture();
  const recording =
    recorder.status === 'recording' ||
    recorder.status === 'lock_armed' ||
    recorder.status === 'cancel_armed' ||
    recorder.status === 'locked';

  // RecordingOverlay owns the dim layer globally — avoid double-dimming here.
  const threadStyle: React.CSSProperties = {
    pointerEvents: recording ? 'none' : 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  };

  return (
    <div
      className="chat-scroll"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        padding: '20px 16px var(--thread-scroll-pad, 200px)',
        maxWidth: 640,
        width: '100%',
        margin: '0 auto',
        gap: 18,
      }}
    >
      <div style={threadStyle}>
        {visibleMessages.length === 0 && !recording && <WelcomeAgent />}

        {visibleMessages.map((m) => (
          <MemoMessageBubble
            key={m.id}
            message={m}
            onRetry={() => retryBubble(m.id)}
            onDiscard={() => discardBubble(m.id)}
            onPaste={() => openPaste(m.id)}
            onDelete={() => softDelete(m.id)}
            pasteOpen={pasteOpenForId === m.id}
            pasteDraft={pasteDraft}
            setPasteDraft={setPasteDraft}
            onPasteSubmit={() => submitPaste(m.id)}
            onPasteCancel={closePaste}
            onSaveAsMemo={() => saveAskAsMemo(m.id)}
          />
        ))}
      </div>
    </div>
  );
}

// The wingmic agent mark — a small italic-serif "W" sticker. Mirrors the
// recording-state avatar in ChatHeader so the agent reads as one identity
// across the surface. Used by the welcome row + every agent reply.
function WingmicAvatar() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 28,
        height: 28,
        background: accent,
        border: '1.5px solid #000',
        boxShadow: '2px 2px 0 #000',
        borderRadius: 6,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontFamily: 'Newsreader, Georgia, serif',
        fontStyle: 'italic',
        fontSize: 14,
        fontWeight: 600,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      W
    </span>
  );
}

// Suggested queries shown on the empty thread (PR ε, per proto-screens-a.jsx
// ScreenChatResting). The prototype anchors a composer pill these chips would
// fill; the shipped surface has no in-thread composer (one mic, one surface —
// recording is the global nav orb), so chips link to the live query surface
// (/search) instead, carrying the query in `?q=` so intent survives the hop.
// /search reads the param (SearchClient seeds its input from `?q=`), so the
// chip lands on a pre-run query (PR θ-search).
const SUGGESTED_QUERIES = [
  'who was the rust person at acme?',
  "remind me of last week's coffee chats",
  'who should i introduce to priya?',
] as const;

function WelcomeAgent() {
  return (
    <div style={{ padding: '24px 0 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <WingmicAvatar />
        <div style={{ maxWidth: 340 }}>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '4px 14px 14px 14px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border-mid)',
              fontSize: 14.5,
              lineHeight: 1.55,
              color: 'var(--text-85)',
            }}
          >
            morning.{' '}
            <span className="serif" style={{ fontStyle: 'italic', color: accent }}>
              ask me anything
            </span>{' '}
            — who you met, what was said, who to thread. or just tap the mic and tell me about
            a new contact.
          </div>
        </div>
      </div>
      <div
        style={{
          marginLeft: 38,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          alignItems: 'flex-start',
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: 'var(--text-40)',
            marginBottom: 2,
          }}
        >
          ↪ try
        </div>
        {SUGGESTED_QUERIES.map((q) => (
          <Link
            key={q}
            href={{ pathname: '/search', query: { q } }}
            data-testid="chat-suggestion"
            style={{
              alignSelf: 'flex-start',
              padding: '8px 13px',
              borderRadius: 999,
              background: 'var(--surface-1)',
              border: '1px solid var(--border-mid)',
              fontSize: 13,
              color: 'var(--text-85)',
              textDecoration: 'none',
            }}
          >
            {q}
          </Link>
        ))}
      </div>
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
  onSaveAsMemo: () => void;
}

function isEmptyExtraction(e: GraphResult['extracted']): boolean {
  return (
    e.persons.length === 0 &&
    e.companies.length === 0 &&
    e.events.length === 0 &&
    e.topics.length === 0 &&
    e.actions.length === 0
  );
}

function MessageBubble(props: MessageBubbleProps) {
  const { message: m } = props;

  if (m.status === 'failed') return <FailedBubble {...props} />;

  if (m.status === 'answering' || m.status === 'answered') {
    return <AskExchange message={m} onSaveAsMemo={props.onSaveAsMemo} />;
  }

  const showSkeleton = m.status === 'uploading' || m.status === 'transcribing';
  const showLinkSweep = m.status === 'linking';
  const isCommitted = m.status === 'committed';
  // Agent reply renders for every committed memo with a graphResult
  // (including sparse ones — soft "noted" copy). Prefetch hydrates
  // graphResult from DB so refresh keeps the two-sided thread.
  const g = m.graphResult;
  const showAgentReply = isCommitted && g != null;

  return (
    <>
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
          {(() => {
            const jpeg =
              m.previewJpegBase64 ??
              m.graphResult?.attachments?.[0]?.jpegBase64 ??
              null;
            if (!jpeg) return null;
            return (
              // data-url capture; next/image does not take in-memory jpeg
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt="attached photo"
                src={`data:image/jpeg;base64,${jpeg}`}
                style={{
                  width: '100%',
                  maxHeight: 180,
                  objectFit: 'cover',
                  borderRadius: 10,
                  border: '1px solid rgba(0,0,0,0.35)',
                }}
              />
            );
          })()}
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
      </div>
      {showAgentReply && <AgentReply message={m} result={g} />}
    </>
  );
}

const MemoMessageBubble = memo(MessageBubble, (prev, next) => {
  if (prev.message !== next.message) return false;
  if (prev.pasteOpen !== next.pasteOpen) return false;
  // Only the open paste editor cares about draft text churn.
  if (prev.pasteOpen && prev.pasteDraft !== next.pasteDraft) return false;
  return true;
});

// AgentReply — ack + extraction cards in-thread. Person rows stay here;
// dump-to-/acts CTAs were removed (#146).
function AgentReply({ message, result }: { message: ThreadMessage; result: GraphResult }) {
  const { extracted } = result;
  const sparse = isEmptyExtraction(extracted);
  const counts: string[] = [];
  if (extracted.persons.length) {
    counts.push(`${extracted.persons.length} ${extracted.persons.length === 1 ? 'person' : 'people'}`);
  }
  if (extracted.companies.length) {
    counts.push(
      `${extracted.companies.length} ${extracted.companies.length === 1 ? 'company' : 'companies'}`,
    );
  }
  if (extracted.events.length) {
    counts.push(`${extracted.events.length} ${extracted.events.length === 1 ? 'event' : 'events'}`);
  }
  if (extracted.topics.length) {
    counts.push(`${extracted.topics.length} ${extracted.topics.length === 1 ? 'topic' : 'topics'}`);
  }
  const summary = sparse
    ? 'noted — nothing solid to tag yet.'
    : `acknowledged. ${counts.length ? `captured ${counts.join(', ')}.` : 'captured your memo.'}`;
  const time = message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      data-testid="agent-reply"
      style={{
        alignSelf: 'flex-start',
        maxWidth: '92%',
        width: '100%',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
      }}
    >
      <WingmicAvatar />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span
            className="mono"
            style={{ fontSize: 12, fontWeight: 700, color: accent, letterSpacing: 0.4 }}
          >
            wingmic
          </span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-30)' }}>
            {time}
          </span>
        </div>
        <div
          data-testid={sparse ? 'agent-reply-soft' : 'agent-reply-ack'}
          style={{
            padding: '12px 14px',
            borderRadius: '4px 14px 14px 14px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border-mid)',
            color: 'var(--text-85)',
            fontSize: 14.5,
            lineHeight: 1.55,
          }}
        >
          {summary}
        </div>
        {!sparse ? <GraphCard message={message} result={result} /> : null}
      </div>
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
      g.extracted.topics.length === 0 &&
      g.extracted.actions.length === 0;
    if (isEmpty) {
      // Soft agent reply carries the "nothing solid" copy; footer stays timing-only.
      return (
        <div className="mono" style={{ fontSize: 10, color: meta }}>
          {fmtMs(m.transcribeMs)} transcribe · {fmtMs(m.commitMs)} commit
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
        border: '1px solid rgba(255,107,107,0.35)',
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
    case 'ask_failed':
      return 'search';
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
    case 'ask_failed':
      return ['retry', 'discard'];
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
  const { openTarget, setOpenTarget } = useCapture();
  if (isEmptyExtraction(extracted)) return null;

  const claimed = new Set<number>();
  const personActions = extracted.persons.map((p) => {
    const idx = extracted.actions.findIndex(
      (a, i) =>
        !claimed.has(i) &&
        a.targetPersonName != null &&
        a.targetPersonName.trim().toLowerCase() === p.name.trim().toLowerCase(),
    );
    if (idx < 0) return null;
    claimed.add(idx);
    return extracted.actions[idx] ?? null;
  });
  const leftoverActions = extracted.actions.filter((_, i) => !claimed.has(i));

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            className="mono"
            style={{ fontSize: 9.5, color: 'var(--text-40)', letterSpacing: 2, textTransform: 'uppercase' }}
          >
            people
          </div>
          {extracted.persons.map((p, i) => {
            const entityId = result.entityIds?.[i];
            const href = hrefFor('person', result.entityIds, i);
            const selected =
              !!entityId &&
              openTarget?.interactionId === result.interactionId &&
              openTarget.entityId === entityId;
            return (
              <PersonCaptureCard
                key={`${p.name}-${i}`}
                person={p}
                href={href}
                selected={selected}
                action={personActions[i]}
                onPhoto={() => {
                  if (!entityId) return;
                  setOpenTarget({ interactionId: result.interactionId, entityId, name: p.name });
                }}
              />
            );
          })}
        </div>
      )}

      {(extracted.companies.length > 0 || extracted.events.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {extracted.companies.map((c) => (
            <TagPill
              key={`co-${c.name}`}
              color={blue}
              href={hrefByName('company', extracted.companies, result.companyIds, c.name)}
            >
              {c.name}
            </TagPill>
          ))}
          {extracted.events.map((e) => (
            <TagPill
              key={`ev-${e.name}`}
              color={third}
              href={hrefByName('event', extracted.events, result.eventIds, e.name)}
            >
              {e.name}
            </TagPill>
          ))}
        </div>
      )}

      {leftoverActions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            className="mono"
            style={{ fontSize: 9.5, color: 'var(--text-40)', letterSpacing: 2, textTransform: 'uppercase' }}
          >
            follow-ups
          </div>
          {leftoverActions.slice(0, 2).map((a, i) => (
            <ActionCard key={i} action={a} />
          ))}
          {leftoverActions.length > 2 && (
            <div className="mono" style={{ fontSize: 11, color: accent }}>
              +{leftoverActions.length - 2} more →
            </div>
          )}
        </div>
      )}

      {extracted.topics.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            className="mono"
            style={{ fontSize: 9.5, color: 'var(--text-40)', letterSpacing: 2, textTransform: 'uppercase' }}
          >
            topics
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {extracted.topics.map((t) => (
              <TagPill key={t} color={violet}>
                {t}
              </TagPill>
            ))}
          </div>
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

// Build a `/person/{id}` href from positional extracted.persons + entityIds.
// Returns null when ids are missing (past-prefetch bubbles, tests) so the
// pill renders as a non-navigable span instead of `/person/undefined`.
function hrefFor(
  kind: 'person',
  ids: string[] | undefined,
  i: number,
): string | null {
  const id = ids?.[i];
  return id ? `/${kind}/${encodeURIComponent(id)}` : null;
}

// Build a /company/{id} or /event/{id} href by matching the chip's name to
// the deduped name-ordered id list the server returns. The server (commit
// in resolution.ts) builds a Map keyed by candidate name, so [...map.values()]
// is in first-occurrence order — the same order we get from de-duping client
// side. If the name isn't found (mismatch, tests), returns null.
function hrefByName(
  kind: 'company' | 'event',
  items: Array<{ name: string }>,
  ids: string[] | undefined,
  name: string,
): string | null {
  if (!ids || !ids.length) return null;
  const uniqueNames: string[] = [];
  const seen = new Set<string>();
  for (const x of items) {
    if (!seen.has(x.name)) {
      seen.add(x.name);
      uniqueNames.push(x.name);
    }
  }
  const idx = uniqueNames.indexOf(name);
  const id = idx >= 0 ? ids[idx] : undefined;
  return id ? `/${kind}/${encodeURIComponent(id)}` : null;
}

function TagPill({
  color,
  children,
  href,
}: {
  color: string;
  children: React.ReactNode;
  href?: string | null;
}) {
  const style: React.CSSProperties = {
    padding: '3px 9px',
    borderRadius: 999,
    background: `${color}1f`,
    color,
    border: `1px solid ${color}40`,
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textDecoration: 'none',
    display: 'inline-block',
  };
  if (href) {
    return (
      <a className="mono" href={href} style={style}>
        {children}
      </a>
    );
  }
  return (
    <span className="mono" style={style}>
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

export function UndoChip() {
  const { undoQueue, undoDelete } = useCapture();
  const latest = undoQueue[undoQueue.length - 1];
  if (!latest) return null;
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'calc(var(--chat-composer-bottom, 72px) + 64px)',
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
        onClick={() => undoDelete(latest.id)}
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
