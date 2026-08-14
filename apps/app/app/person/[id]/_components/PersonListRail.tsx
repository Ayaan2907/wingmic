'use client';

/**
 * PersonListRail — desktop people list beside person detail.
 * Live `entity.listPeople` only — no fixture names.
 */

import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { accent } from '@/app/chat/_components/tokens';

export function PersonListRail() {
  const params = useParams();
  const activeId = typeof params?.id === 'string' ? params.id : null;
  const { data, isLoading } = trpc.entity.listPeople.useQuery({ limit: 40 });

  const people = data?.people ?? [];

  return (
    <aside
      className="surface-secondary"
      aria-label="people"
      data-testid="person-list-rail"
      style={{
        padding: '16px 12px',
        borderRight: '1px solid var(--border-soft)',
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
          color: 'var(--text-40)',
          padding: '4px 8px 12px',
        }}
      >
        people
      </div>
      {isLoading ? (
        <p className="mono" style={{ fontSize: 11, color: 'var(--text-40)', padding: 8 }}>
          loading…
        </p>
      ) : people.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-40)', padding: 8, lineHeight: 1.45 }}>
          no people yet — import contacts or commit a memo.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {people.map((p) => {
            const active = p.id === activeId;
            return (
              <li key={p.id}>
                <Link
                  href={`/person/${p.id}` as Route}
                  data-testid={`person-rail-row-${p.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 8px',
                    borderRadius: 10,
                    textDecoration: 'none',
                    color: 'inherit',
                    background: active ? `${accent}22` : 'transparent',
                    border: active ? `1px solid ${accent}55` : '1px solid transparent',
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: accent,
                      color: '#000',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 12,
                      flexShrink: 0,
                    }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: active ? 700 : 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
