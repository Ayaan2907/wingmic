'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { useSpeechRecognition } from './_components/useSpeechRecognition';

const accent = '#FFC452';
const second = '#86efac';
const third = '#FF8FAB';
const violet = '#A78BFA';
const blue = '#7DD3FC';

type Mode = 'capture' | 'review' | 'done' | 'error';

export default function CaptureClient({ userName }: { userName: string | null }) {
  const sr = useSpeechRecognition('en-US');
  const [mode, setMode] = useState<Mode>('capture');
  const [editedTranscript, setEditedTranscript] = useState('');
  const [committed, setCommitted] = useState<Awaited<
    ReturnType<typeof commitMutation.mutateAsync>
  > | null>(null);

  const commitMutation = trpc.capture.commit.useMutation({
    onSuccess: (data) => {
      setCommitted(data);
      setMode('done');
    },
    onError: () => setMode('error'),
  });

  const transcript = (mode === 'review' ? editedTranscript : sr.finalTranscript).trim();
  const liveDisplay = (sr.finalTranscript + sr.interimTranscript).trim();

  function handleStart() {
    sr.reset();
    setCommitted(null);
    setMode('capture');
    sr.start();
  }

  function handleStop() {
    sr.stop();
    setEditedTranscript(sr.finalTranscript.trim());
    setMode('review');
  }

  function handleCommit() {
    const t = (mode === 'review' ? editedTranscript : sr.finalTranscript).trim();
    if (!t) return;
    commitMutation.mutate({ transcript: t });
  }

  function handleNew() {
    sr.reset();
    setEditedTranscript('');
    setCommitted(null);
    setMode('capture');
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
    >
      <Header userName={userName} />

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 20px 120px',
          maxWidth: 640,
          width: '100%',
          margin: '0 auto',
          gap: 24,
        }}
      >
        {(mode === 'capture' || mode === 'review') && (
          <TranscriptPane
            mode={mode}
            live={liveDisplay}
            edited={editedTranscript}
            setEdited={setEditedTranscript}
            interim={sr.interimTranscript}
            listening={sr.status === 'listening'}
            error={sr.error}
            supported={sr.supported}
          />
        )}

        {mode === 'done' && committed && <ResultPane result={committed} />}

        {mode === 'error' && (
          <ErrorPane
            message={commitMutation.error?.message ?? 'commit failed'}
            onRetry={handleCommit}
            onReset={handleNew}
          />
        )}
      </div>

      <ControlBar
        mode={mode}
        listening={sr.status === 'listening'}
        starting={sr.status === 'starting'}
        committing={commitMutation.isPending}
        canCommit={transcript.length > 0}
        onStart={handleStart}
        onStop={handleStop}
        onCommit={handleCommit}
        onNew={handleNew}
        supported={sr.supported}
      />
    </main>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────

function Header({ userName }: { userName: string | null }) {
  return (
    <header
      style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border-soft)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <a
        href="/"
        className="mono"
        style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.5, color: 'var(--ink)' }}
      >
        wingmic<span style={{ color: 'var(--text-30)' }}>.xyz</span>
      </a>
      <span
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: 1,
          color: 'var(--text-40)',
          textTransform: 'uppercase',
        }}
      >
        capture · {userName ?? 'you'}
      </span>
    </header>
  );
}

// ─── Transcript pane (capture + review) ─────────────────────────────────

function TranscriptPane({
  mode,
  live,
  edited,
  setEdited,
  interim,
  listening,
  error,
  supported,
}: {
  mode: Mode;
  live: string;
  edited: string;
  setEdited: (v: string) => void;
  interim: string;
  listening: boolean;
  error: string | null;
  supported: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: 2,
          color: accent,
          textTransform: 'uppercase',
        }}
      >
        {listening ? '● recording' : mode === 'review' ? 'review · edit' : 'idle'}
      </div>

      <h1
        style={{
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: '-0.025em',
          lineHeight: 1.1,
        }}
      >
        {mode === 'review' ? (
          <>
            looks right?{' '}
            <span className="serif" style={{ fontStyle: 'italic', color: accent, fontWeight: 400 }}>
              commit it.
            </span>
          </>
        ) : listening ? (
          <>
            tell me about{' '}
            <span className="serif" style={{ fontStyle: 'italic', color: accent, fontWeight: 400 }}>
              who you met.
            </span>
          </>
        ) : (
          <>
            tap the mic.{' '}
            <span className="serif" style={{ fontStyle: 'italic', color: accent, fontWeight: 400 }}>
              start talking.
            </span>
          </>
        )}
      </h1>

      {!supported && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: 'rgba(255, 107, 107, 0.08)',
            border: '1px solid rgba(255, 107, 107, 0.25)',
            color: '#FF8888',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          your browser doesn't support voice capture. type below instead.
        </div>
      )}

      {error && supported && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 10,
            background: 'rgba(255, 107, 107, 0.08)',
            border: '1px solid rgba(255, 107, 107, 0.25)',
            color: '#FF8888',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          padding: 18,
          borderRadius: 14,
          background: 'var(--surface-2)',
          border: `1px solid ${listening ? accent + '50' : 'var(--border-soft)'}`,
          minHeight: 200,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {mode === 'review' ? (
          <textarea
            value={edited}
            onChange={(e) => setEdited(e.target.value)}
            autoFocus
            placeholder="edit before committing..."
            style={{
              width: '100%',
              minHeight: 200,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--ink)',
              fontSize: 16,
              lineHeight: 1.55,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        ) : (
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.55,
              color: live ? 'var(--ink)' : 'var(--text-40)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {live ||
              'met sarah from acme at the rust meetup, she leads their edge runtime team, send her the github link tomorrow morning...'}
            {interim && (
              <span style={{ color: 'var(--text-55)' }}> {interim}</span>
            )}
            {listening && (
              <span
                style={{
                  display: 'inline-block',
                  width: 2,
                  height: 18,
                  background: accent,
                  marginLeft: 2,
                  verticalAlign: 'middle',
                  animation: 'blink 0.7s step-end infinite',
                }}
              />
            )}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Result pane ─────────────────────────────────────────────────────────

function ResultPane({
  result,
}: {
  result: {
    extracted: {
      persons: Array<{ name: string; role: string | null; companyHint: string | null; topics: string[] }>;
      companies: Array<{ name: string }>;
      events: Array<{ name: string }>;
      topics: string[];
      actions: Array<{ kind: string; body: string; whenHint: string | null }>;
    };
    newEntities: number;
    matchedEntities: number;
    interactionId: string;
  };
}) {
  const { extracted, newEntities, matchedEntities } = result;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: 2,
          color: second,
          textTransform: 'uppercase',
        }}
      >
        ✓ committed
      </div>
      <h1
        style={{
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: '-0.025em',
          lineHeight: 1.1,
        }}
      >
        graph updated.{' '}
        <span className="serif" style={{ fontStyle: 'italic', color: accent, fontWeight: 400 }}>
          {newEntities} new
        </span>
        {matchedEntities > 0 && (
          <>
            ,{' '}
            <span className="serif" style={{ fontStyle: 'italic', color: blue, fontWeight: 400 }}>
              {matchedEntities} linked
            </span>
          </>
        )}
        .
      </h1>

      {extracted.persons.length > 0 && (
        <Section title="people">
          {extracted.persons.map((p) => (
            <Card key={p.name}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{p.name}</div>
              {(p.role || p.companyHint) && (
                <div style={{ fontSize: 13, color: 'var(--text-55)', marginTop: 4 }}>
                  {p.role}
                  {p.role && p.companyHint && ' · '}
                  {p.companyHint && <span style={{ color: blue }}>{p.companyHint}</span>}
                </div>
              )}
              {p.topics.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {p.topics.map((t) => (
                    <Pill key={t} color={violet}>
                      {t}
                    </Pill>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </Section>
      )}

      {(extracted.companies.length > 0 || extracted.events.length > 0) && (
        <Section title="canonical">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {extracted.companies.map((c) => (
              <Pill key={c.name} color={blue}>
                {c.name}
              </Pill>
            ))}
            {extracted.events.map((e) => (
              <Pill key={e.name} color={third}>
                {e.name}
              </Pill>
            ))}
          </div>
        </Section>
      )}

      {extracted.actions.length > 0 && (
        <Section title="follow-ups">
          {extracted.actions.map((a, i) => (
            <Card key={i}>
              <div className="mono" style={{ fontSize: 11, color: accent, letterSpacing: 1, textTransform: 'uppercase' }}>
                {a.kind}
              </div>
              <div style={{ fontSize: 15, marginTop: 6 }}>{a.body}</div>
              {a.whenHint && (
                <div style={{ fontSize: 12, color: 'var(--text-40)', marginTop: 6 }}>
                  due: {a.whenHint}
                </div>
              )}
            </Card>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: 2,
          color: 'var(--text-40)',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        background: 'var(--surface-1)',
        border: '1px solid var(--border-soft)',
      }}
    >
      {children}
    </div>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="mono"
      style={{
        padding: '4px 10px',
        borderRadius: 999,
        background: `${color}20`,
        color,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

// ─── Error pane ──────────────────────────────────────────────────────────

function ErrorPane({
  message,
  onRetry,
  onReset,
}: {
  message: string;
  onRetry: () => void;
  onReset: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: 2,
          color: '#FF6B6B',
          textTransform: 'uppercase',
        }}
      >
        commit failed
      </div>
      <p style={{ fontSize: 16, lineHeight: 1.55, color: 'var(--text-70)' }}>{message}</p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onRetry} style={primaryBtn}>
          retry →
        </button>
        <button onClick={onReset} style={ghostBtn}>
          start over
        </button>
      </div>
    </div>
  );
}

// ─── Control bar (fixed bottom) ──────────────────────────────────────────

function ControlBar({
  mode,
  listening,
  starting,
  committing,
  canCommit,
  onStart,
  onStop,
  onCommit,
  onNew,
  supported,
}: {
  mode: Mode;
  listening: boolean;
  starting: boolean;
  committing: boolean;
  canCommit: boolean;
  onStart: () => void;
  onStop: () => void;
  onCommit: () => void;
  onNew: () => void;
  supported: boolean;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        padding: '16px 20px calc(16px + env(safe-area-inset-bottom))',
        background: 'rgba(10,10,10,0.92)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border-soft)',
        display: 'flex',
        gap: 10,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 50,
      }}
    >
      {mode === 'capture' && supported && !listening && (
        <button
          onClick={onStart}
          disabled={starting}
          aria-label="start recording"
          style={{
            ...primaryBtn,
            padding: '16px 28px',
            fontSize: 16,
            opacity: starting ? 0.7 : 1,
          }}
        >
          {starting ? 'starting...' : '🎤 start recording'}
        </button>
      )}

      {mode === 'capture' && listening && (
        <button onClick={onStop} aria-label="stop recording" style={alarmBtn}>
          ◼ stop
        </button>
      )}

      {mode === 'review' && (
        <>
          <button onClick={onNew} style={ghostBtn}>
            re-record
          </button>
          <button
            onClick={onCommit}
            disabled={!canCommit || committing}
            style={{
              ...primaryBtn,
              opacity: !canCommit || committing ? 0.6 : 1,
            }}
          >
            {committing ? 'committing...' : 'commit →'}
          </button>
        </>
      )}

      {mode === 'done' && (
        <>
          <button onClick={onNew} style={primaryBtn}>
            capture another →
          </button>
          <a href="/recall" style={{ ...ghostBtn, textDecoration: 'none' }}>
            recall
          </a>
        </>
      )}

      {mode === 'error' && (
        <button onClick={onNew} style={ghostBtn}>
          start over
        </button>
      )}
    </div>
  );
}

// ─── Button styles ───────────────────────────────────────────────────────

const primaryBtn: React.CSSProperties = {
  padding: '14px 24px',
  borderRadius: 10,
  background: accent,
  color: '#000',
  fontWeight: 700,
  fontSize: 15,
  border: '1.5px solid #000',
  boxShadow: '4px 4px 0 #000',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const ghostBtn: React.CSSProperties = {
  padding: '14px 22px',
  borderRadius: 10,
  background: 'transparent',
  color: 'var(--ink)',
  fontWeight: 600,
  fontSize: 15,
  border: '1.5px solid var(--border-mid)',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const alarmBtn: React.CSSProperties = {
  padding: '16px 28px',
  borderRadius: 10,
  background: '#FF6B6B',
  color: '#000',
  fontWeight: 700,
  fontSize: 16,
  border: '1.5px solid #000',
  boxShadow: '4px 4px 0 #000',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
