'use client';

/**
 * ChatEntityRail — desktop "in this thread" column.
 * Built from committed messages' graphResult (live only — no fixtures).
 */

import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useCapture } from '@/app/_components/CaptureProvider';
import { accent } from '@/app/chat/_components/tokens';
import type { ThreadMessage } from '@/app/chat/_components/types';

type RailPerson = {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  topics: string[];
  followUp: boolean;
};

type RailExtracted = {
  person: string[];
  company: string[];
  event: string[];
  concept: string[];
};

function collectFromMessages(messages: ThreadMessage[]): {
  people: RailPerson[];
  extracted: RailExtracted;
} {
  const people: RailPerson[] = [];
  const seenPerson = new Set<string>();
  const extracted: RailExtracted = {
    person: [],
    company: [],
    event: [],
    concept: [],
  };
  const pushUnique = (list: string[], value: string) => {
    const key = value.trim().toLowerCase();
    if (!key || list.some((v) => v.toLowerCase() === key)) return;
    list.push(value);
  };

  for (const m of messages) {
    if (m.status !== 'committed' || !m.graphResult) continue;
    const g = m.graphResult;
    const { extracted: ex } = g;
    for (let i = 0; i < ex.persons.length; i++) {
      const p = ex.persons[i]!;
      const id = g.entityIds?.[i] ?? `name:${p.name.toLowerCase()}`;
      if (!seenPerson.has(id)) {
        seenPerson.add(id);
        people.push({
          id,
          name: p.name,
          role: p.role,
          company: p.companyHint,
          topics: p.topics,
          followUp: ex.actions.length > 0,
        });
      }
      pushUnique(extracted.person, p.name);
    }
    for (const c of ex.companies) pushUnique(extracted.company, c.name);
    for (const e of ex.events) pushUnique(extracted.event, e.name);
    for (const t of ex.topics) pushUnique(extracted.concept, t);
  }

  return { people, extracted };
}

export function ChatEntityRail() {
  const { messages } = useCapture();
  const { people, extracted } = React.useMemo(
    () => collectFromMessages(messages),
    [messages],
  );

  const hasAnything =
    people.length > 0 ||
    extracted.person.length > 0 ||
    extracted.company.length > 0 ||
    extracted.event.length > 0 ||
    extracted.concept.length > 0;

  if (!hasAnything) {
    return (
      <aside
        className="surface-secondary"
        data-testid="chat-entity-rail"
        data-empty="true"
        style={{
          padding: 20,
          borderLeft: '1px solid var(--border-soft)',
          color: 'var(--text-40)',
          fontSize: 13,
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginBottom: 12,
            color: 'var(--text-40)',
          }}
        >
          in this thread
        </div>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          commit a memo — people and tags land here.
        </p>
      </aside>
    );
  }

  return (
    <aside
      className="surface-secondary"
      data-testid="chat-entity-rail"
      style={{
        padding: 20,
        borderLeft: '1px solid var(--border-soft)',
        overflowY: 'auto',
        maxHeight: '100dvh',
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          marginBottom: 16,
          color: 'var(--text-40)',
        }}
      >
        in this thread
      </div>

      {people.map((p) => {
        const href = p.id.startsWith('name:') ? null : (`/person/${p.id}` as Route);
        const sub = [p.role, p.company].filter(Boolean).join(' · ');
        const body = (
          <>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: accent,
                color: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              {p.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.name}</div>
              {sub ? (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-55)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {sub}
                </div>
              ) : null}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                {p.topics.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="mono"
                    style={{
                      fontSize: 9,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'var(--surface-1)',
                      color: 'var(--text-55)',
                    }}
                  >
                    #{t}
                  </span>
                ))}
                {p.followUp ? (
                  <span
                    className="mono"
                    style={{
                      fontSize: 9,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: accent,
                      color: '#000',
                      fontWeight: 700,
                    }}
                  >
                    follow-up
                  </span>
                ) : null}
              </div>
            </div>
          </>
        );
        return href ? (
          <Link
            key={p.id}
            href={href}
            data-testid={`chat-rail-person-${p.id}`}
            style={{
              display: 'flex',
              gap: 10,
              marginBottom: 16,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            {body}
          </Link>
        ) : (
          <div
            key={p.id}
            data-testid={`chat-rail-person-${p.id}`}
            style={{ display: 'flex', gap: 10, marginBottom: 16 }}
          >
            {body}
          </div>
        );
      })}

      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: 'var(--text-40)',
          margin: '8px 0 10px',
        }}
      >
        extracted
      </div>
      {(
        [
          ['person', extracted.person],
          ['company', extracted.company],
          ['event', extracted.event],
          ['concept', extracted.concept],
        ] as const
      ).map(([label, values]) =>
        values.length === 0 ? null : (
          <div key={label} style={{ marginBottom: 8, fontSize: 12.5 }}>
            <span className="mono" style={{ color: 'var(--text-40)', fontSize: 10 }}>
              {label}:{' '}
            </span>
            {values.join(', ')}
          </div>
        ),
      )}
    </aside>
  );
}
