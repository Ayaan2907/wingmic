'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { accent, blue, second, violet } from './tokens';
import { canonicalizeLinkedin, linkedinHandle } from '@wingmic/extractor/linkedin';

export type PersonCaptureAction = {
  kind: string;
  body: string;
  whenHint: string | null;
};

export type PersonCaptureCardPerson = {
  name: string;
  role: string | null;
  companyHint: string | null;
  topics: string[];
  linkedin?: string | null;
};

export function PersonCaptureCard({
  person,
  href,
  selected,
  action,
  onPhoto,
}: {
  person: PersonCaptureCardPerson;
  href: string | null;
  selected?: boolean;
  action?: PersonCaptureAction | null;
  onPhoto: () => void;
}) {
  const handle = linkedinHandle(person.linkedin ?? null);
  const linkedinHref = person.linkedin ? canonicalizeLinkedin(person.linkedin) : null;
  const monogram = person.name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const promise = action?.whenHint?.trim() || null;
  const nameId = person.name.replace(/\s+/g, '-').toLowerCase();

  return (
    <div
      data-testid="person-capture-card"
      data-entity-kind="person"
      data-selected={selected ? 'true' : 'false'}
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        padding: '10px 12px',
        borderRadius: 12,
        background: 'var(--surface-2)',
        border: selected ? `1.5px solid ${accent}` : '1px solid var(--border-soft)',
        boxShadow: selected ? '2px 2px 0 #000' : 'none',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: accent,
          color: '#000',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 12,
          fontFamily: 'Inter, system-ui, sans-serif',
          flexShrink: 0,
          border: '1.5px solid #000',
        }}
      >
        {monogram}
      </span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            {href ? (
              <Link
                href={href as Route}
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--ink)',
                  textDecoration: 'none',
                  lineHeight: 1.2,
                }}
              >
                {person.name}
              </Link>
            ) : (
              <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{person.name}</span>
            )}
            {(person.role || person.companyHint) && (
              <div style={{ fontSize: 11.5, color: 'var(--text-55)', marginTop: 2 }}>
                {person.role}
                {person.role && person.companyHint ? ' · ' : null}
                {person.companyHint ? <span style={{ color: blue }}>{person.companyHint}</span> : null}
              </div>
            )}
            {handle && linkedinHref ? (
              <a
                href={linkedinHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mono"
                style={{ fontSize: 11, color: accent, textDecoration: 'none', display: 'inline-block', marginTop: 3 }}
              >
                in/{handle} →
              </a>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <GhostAction
              label="photo"
              ariaLabel={`add photo for ${person.name}`}
              testId={`person-photo-${nameId}`}
              onClick={onPhoto}
            />
          </div>
        </div>
        {(person.topics.length > 0 || promise) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {person.topics.slice(0, 3).map((topic) => (
              <span
                key={topic}
                className="mono"
                style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: `${violet}1f`,
                  color: violet,
                  border: `1px solid ${violet}40`,
                  fontSize: 10,
                  letterSpacing: 0.4,
                }}
              >
                {topic}
              </span>
            ))}
            {promise ? (
              <span className="mono" style={{ fontSize: 10.5, color: second }}>
                promised {promise}
              </span>
            ) : null}
          </div>
        )}
        {action?.body ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-70)', lineHeight: 1.4 }}>
            {action.body}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GhostAction({
  label,
  ariaLabel,
  testId,
  onClick,
}: {
  label: string;
  ariaLabel: string;
  testId: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        padding: 0,
        background: 'transparent',
        border: 'none',
        color: 'var(--text-55)',
        font: '700 11px Inter, system-ui, sans-serif',
        cursor: 'pointer',
        textDecoration: 'underline',
        textUnderlineOffset: 2,
      }}
    >
      {label}
    </button>
  );
}
