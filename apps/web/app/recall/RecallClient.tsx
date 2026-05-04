'use client';

import { useState, type FormEvent } from 'react';
import { trpc } from '@/lib/trpc/client';

const accent = '#FFC452';
const second = '#86efac';
const third = '#FF8FAB';
const violet = '#A78BFA';
const blue = '#7DD3FC';

export default function RecallClient() {
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);

  const recall = trpc.recall.query.useQuery(
    { q: submitted ?? '', limit: 12 },
    { enabled: submitted != null && submitted.trim().length > 0, staleTime: 60_000 },
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = q.trim();
    if (next) setSubmitted(next);
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
        <a
          href="/capture"
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: 1,
            color: accent,
            textTransform: 'uppercase',
            textDecoration: 'underline',
            textUnderlineOffset: 4,
          }}
        >
          + capture
        </a>
      </header>

      <div
        style={{
          maxWidth: 720,
          width: '100%',
          margin: '0 auto',
          padding: '32px 20px 80px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <div>
          <div
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: 2,
              color: accent,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            recall
          </div>
          <h1
            style={{
              fontSize: 'clamp(28px, 6vw, 44px)',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              lineHeight: 1.05,
            }}
          >
            ask anything.{' '}
            <span className="serif" style={{ fontStyle: 'italic', color: accent, fontWeight: 400 }}>
              plain english.
            </span>
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-55)', lineHeight: 1.55, marginTop: 12 }}>
            try: <em>who at acme works on rust?</em> · <em>founders i met at devconnect</em> ·{' '}
            <em>people who ship edge workers</em>
          </p>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', gap: 10 }}>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='"who at acme works on rust?"'
            autoFocus
            style={{
              flex: 1,
              padding: '14px 16px',
              borderRadius: 10,
              background: 'var(--surface-2)',
              border: '1px solid var(--border-mid)',
              color: 'var(--ink)',
              fontSize: 15.5,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={!q.trim() || recall.isFetching}
            style={{
              padding: '14px 20px',
              borderRadius: 10,
              background: accent,
              color: '#000',
              fontWeight: 700,
              fontSize: 15,
              border: '1.5px solid #000',
              boxShadow: '4px 4px 0 #000',
              cursor: !q.trim() || recall.isFetching ? 'wait' : 'pointer',
              opacity: !q.trim() || recall.isFetching ? 0.7 : 1,
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {recall.isFetching ? 'searching...' : 'ask →'}
          </button>
        </form>

        {recall.error && (
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
            {recall.error.message}
          </div>
        )}

        {recall.data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              className="mono"
              style={{
                fontSize: 11,
                letterSpacing: 1,
                color: 'var(--text-40)',
                textTransform: 'uppercase',
              }}
            >
              ↪ {recall.data.entities.length} match
              {recall.data.entities.length === 1 ? '' : 'es'} in {recall.data.durationMs}ms
            </div>

            {recall.data.entities.length === 0 && submitted && (
              <div
                style={{
                  padding: 24,
                  borderRadius: 12,
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border-soft)',
                  color: 'var(--text-55)',
                  fontSize: 15,
                  lineHeight: 1.55,
                }}
              >
                no matches yet. capture a few people first, then try again.
              </div>
            )}

            {recall.data.entities.map((e) => (
              <ResultCard key={e.id} entity={e} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function ResultCard({
  entity,
}: {
  entity: {
    id: string;
    name: string;
    aliases: string[];
    score: number;
    companies: Array<{ id: string; name: string; role: string | null }>;
    events: Array<{ id: string; name: string }>;
    topics: Array<{ id: string; name: string }>;
    facts: Array<{ key: string; value: string; confidence: number }>;
  };
}) {
  const primaryCompany = entity.companies[0] ?? null;
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 14,
        background: 'var(--surface-1)',
        border: '1px solid var(--border-soft)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>{entity.name}</div>
          {primaryCompany && (
            <div style={{ fontSize: 14, color: 'var(--text-55)', marginTop: 4 }}>
              {primaryCompany.role && <span>{primaryCompany.role} · </span>}
              <span style={{ color: blue }}>{primaryCompany.name}</span>
            </div>
          )}
        </div>
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: entity.score > 0.7 ? second : entity.score > 0.5 ? accent : 'var(--text-40)',
            letterSpacing: 1,
          }}
        >
          {(entity.score * 100).toFixed(0)}%
        </span>
      </div>

      {entity.topics.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {entity.topics.map((t) => (
            <span
              key={t.id}
              className="mono"
              style={{
                padding: '3px 9px',
                borderRadius: 999,
                background: `${violet}20`,
                color: violet,
                fontSize: 10.5,
                fontWeight: 600,
              }}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}

      {entity.events.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {entity.events.map((ev) => (
            <span
              key={ev.id}
              className="mono"
              style={{
                padding: '3px 9px',
                borderRadius: 999,
                background: `${third}20`,
                color: third,
                fontSize: 10.5,
                fontWeight: 600,
              }}
            >
              · met at {ev.name}
            </span>
          ))}
        </div>
      )}

      {entity.facts.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: '14px 0 0',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {entity.facts.map((f, i) => (
            <li
              key={i}
              style={{
                fontSize: 13.5,
                lineHeight: 1.55,
                color: 'var(--text-70)',
                paddingLeft: 14,
                position: 'relative',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '0.55em',
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: 'var(--text-40)',
                }}
              />
              {f.value}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
