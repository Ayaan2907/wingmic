'use client';

import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import type { AskMatch, ThreadMessage } from './types';
import { accent } from './tokens';

export function WingmicAvatar() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 28,
        height: 28,
        borderRadius: 999,
        background: accent,
        border: '1.5px solid #000',
        boxShadow: '2px 2px 0 #000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 800,
        color: '#000',
        flexShrink: 0,
      }}
    >
      w
    </div>
  );
}

/** Left-side agent avatar + speech bubble shell (primitive — #59). */
export function AgentBubble({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <WingmicAvatar />
      <div
        style={{
          padding: '12px 14px',
          borderRadius: '4px 14px 14px 14px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border-mid)',
          fontSize: 14.5,
          lineHeight: 1.55,
          color: 'var(--text-85)',
          maxWidth: 340,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function EntityMatchCard({ match }: { match: AskMatch }) {
  const topic = match.topics[0];
  return (
    <Link
      href={`/person/${match.id}` as Route}
      style={{
        display: 'block',
        padding: '12px 14px',
        borderRadius: 12,
        background: 'var(--surface-1)',
        border: '1px solid var(--border-soft)',
        textDecoration: 'none',
        color: 'var(--text-85)',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14 }}>{match.name}</div>
      {(match.role || match.company) && (
        <div className="mono" style={{ fontSize: 11, color: 'var(--text-55)', marginTop: 4 }}>
          {[match.role, match.company].filter(Boolean).join(' · ')}
        </div>
      )}
      {topic && (
        <span
          className="mono"
          style={{
            display: 'inline-block',
            marginTop: 8,
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 999,
            background: 'var(--surface-2)',
            color: 'var(--text-55)',
          }}
        >
          #{topic}
        </span>
      )}
    </Link>
  );
}

export function AskExchange({
  message,
  onSaveAsMemo,
}: {
  message: ThreadMessage;
  onSaveAsMemo: () => void;
}) {
  const time = message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const q = message.transcript ?? '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
      <div style={{ alignSelf: 'flex-end', maxWidth: '92%' }}>
        <div
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--text-40)',
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginBottom: 6,
            textAlign: 'right',
          }}
        >
          asked · {time}
        </div>
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '18px 18px 4px 18px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border-mid)',
            fontSize: 14.5,
            lineHeight: 1.55,
            color: 'var(--text-85)',
          }}
        >
          {q}
        </div>
      </div>

      <AgentBubble>
        {message.status === 'answering' ? (
          <span style={{ animation: 'wm-pulse-d 1.2s infinite' }}>searching your graph…</span>
        ) : message.ask ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              found {message.ask.matches.length} match
              {message.ask.matches.length === 1 ? '' : 'es'}.
              {message.ask.mode === 'text' ? (
                <span style={{ color: accent }}> · text match</span>
              ) : null}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {message.ask.matches.map((m) => <EntityMatchCard key={m.id} match={m} />)}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
              <Link
                href={{ pathname: '/search', query: { q } }}
                className="mono"
                style={{ fontSize: 11, color: accent, textDecoration: 'none' }}
              >
                open in search →
              </Link>
              <button
                type="button"
                onClick={onSaveAsMemo}
                className="mono"
                style={{
                  fontSize: 11,
                  color: 'var(--text-55)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                ✎ save as memo instead
              </button>
            </div>
          </div>
        ) : null}
      </AgentBubble>
    </div>
  );
}
