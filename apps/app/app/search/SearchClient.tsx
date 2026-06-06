'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { accent, second, third, violet, blue } from '@/app/chat/_components/tokens';

// ── Result shape (mirrors recall.query's returned entities) ─────────────
type Company = { id: string; name: string; role: string | null };
type Edge = { id: string; name: string };
type Entity = {
  id: string;
  name: string;
  aliases: string[];
  score: number;
  companies: Company[];
  events: Edge[];
  topics: Edge[];
  facts: Array<{ key: string; value: string; confidence: number }>;
};

type Grouping = 'recent' | 'by-company' | 'by-event' | 'by-topic';

const GROUPINGS: Array<{ key: Grouping; label: string }> = [
  { key: 'recent', label: 'recent' },
  { key: 'by-company', label: 'by company' },
  { key: 'by-event', label: 'by event' },
  { key: 'by-topic', label: 'by topic' },
];

/**
 * /search — first-class cluster browser over recall.query (PR θ-search).
 *
 * Reuses the recall.query tRPC contract + the ResultCard rendering verbatim
 * from the old RecallClient; the new parts are (a) seeding `q` from `?q=` so
 * the ⌘K palette and chat chips survive the hop, and (b) the segmented
 * control that regroups the SAME ranked result set client-side. Nav chrome is
 * owned by AppShell — this surface renders no header/nav of its own.
 */
export default function SearchClient() {
  const params = useSearchParams();
  const [q, setQ] = useState(() => params?.get('q') ?? '');
  // The queried term lags the input by 350ms so live typing doesn't fire an
  // embedding API call per keystroke. Seeded from `q`, so the `?q=` seed (⌘K /
  // chat chip) queries immediately on mount — only live typing is debounced.
  const [debouncedQ, setDebouncedQ] = useState(q);
  const [grouping, setGrouping] = useState<Grouping>('recent');

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(id);
  }, [q]);

  const search = trpc.recall.query.useQuery(
    { q: debouncedQ.trim(), limit: 20 },
    { enabled: debouncedQ.trim().length > 0, staleTime: 60_000 },
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
  }

  const entities = (search.data?.entities ?? []) as Entity[];
  const hasQuery = debouncedQ.trim().length > 0;

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
      <div
        style={{
          maxWidth: 720,
          width: '100%',
          margin: '0 auto',
          padding: '32px 20px 96px',
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
            search
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
        </form>

        {/* Segmented control — regroups one result set, no new query. */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {GROUPINGS.map((g) => {
            const active = grouping === g.key;
            return (
              <button
                key={g.key}
                type="button"
                aria-pressed={active}
                onClick={() => setGrouping(g.key)}
                className="mono"
                style={{
                  padding: '7px 13px',
                  borderRadius: 999,
                  fontSize: 11,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  border: active ? '1.5px solid #000' : '1px solid var(--border-mid)',
                  background: active ? accent : 'var(--surface-2)',
                  color: active ? '#000' : 'var(--text-55)',
                  boxShadow: active ? '3px 3px 0 #000' : 'none',
                }}
              >
                {g.label}
              </button>
            );
          })}
        </div>

        {search.error && (
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
            {search.error.message}
          </div>
        )}

        {!hasQuery && (
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
            search your graph — who you met, what was said.
          </div>
        )}

        {hasQuery && search.data && (
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
              ↪ {entities.length} match
              {entities.length === 1 ? '' : 'es'} in {search.data.durationMs}ms
            </div>

            {entities.length === 0 ? (
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
            ) : grouping === 'recent' ? (
              entities.map((e) => <ResultCard key={e.id} entity={e} />)
            ) : (
              groupEntities(entities, grouping).map((group) => (
                <ClusterGroup key={group.key} label={group.label} entities={group.entities} />
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// ── Client-side regrouping ──────────────────────────────────────────────
// An entity with N edges of the chosen kind appears under all N headers (a
// cluster browser, not a partition); an entity with no such edge falls into
// the "unsorted" bucket. Preserves the ranked order within each group.
type Group = { key: string; label: string; entities: Entity[] };

function groupEntities(entities: Entity[], grouping: Grouping): Group[] {
  const buckets = new Map<string, Group>();
  const unsorted: Entity[] = [];

  for (const e of entities) {
    const edges =
      grouping === 'by-company'
        ? e.companies.map((c) => ({ id: c.id, name: c.name }))
        : grouping === 'by-event'
          ? e.events
          : e.topics;

    if (edges.length === 0) {
      unsorted.push(e);
      continue;
    }
    for (const edge of edges) {
      const existing = buckets.get(edge.id);
      if (existing) existing.entities.push(e);
      else buckets.set(edge.id, { key: edge.id, label: edge.name, entities: [e] });
    }
  }

  const groups = [...buckets.values()];
  if (unsorted.length > 0) groups.push({ key: '__unsorted', label: 'unsorted', entities: unsorted });
  return groups;
}

function ClusterGroup({ label, entities }: { label: string; entities: Entity[] }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2
        className="mono"
        style={{
          fontSize: 12,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: 'var(--text-70)',
          fontWeight: 700,
          margin: 0,
        }}
      >
        {label}{' '}
        <span style={{ color: 'var(--text-40)' }}>· {entities.length}</span>
      </h2>
      {entities.map((e) => (
        <ResultCard key={`${label}-${e.id}`} entity={e} />
      ))}
    </section>
  );
}

function ResultCard({ entity }: { entity: Entity }) {
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
