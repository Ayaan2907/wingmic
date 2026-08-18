'use client';

import { useState, type FormEvent } from 'react';
import { signIn } from '@/lib/auth-client';

type Status = 'idle' | 'sending' | 'sent' | 'error';

const accent = '#FFC452';

export default function SignInClient({ next = '/chat' }: { next?: string }) {

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus('sending');
    setError(null);
    try {
      await signIn.magicLink({ email, callbackURL: next });
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'sign-in failed');
    }
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        background: 'var(--bg-page)',
        color: 'var(--ink)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          padding: 32,
          borderRadius: 16,
          background: 'var(--surface-1)',
          border: '1px solid var(--border-soft)',
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: 2,
            color: accent,
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          wingmic.xyz
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: '-0.025em',
            lineHeight: 1.05,
            marginBottom: 12,
          }}
        >
          sign in.{' '}
          <span className="serif" style={{ fontStyle: 'italic', color: accent, fontWeight: 400 }}>
            no password.
          </span>
        </h1>
        <p
          style={{
            fontSize: 14.5,
            lineHeight: 1.55,
            color: 'var(--text-55)',
            marginBottom: 24,
          }}
        >
          drop your email — we send a one-tap link that signs you in for the next 30 days.
        </p>

        {status === 'sent' ? (
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background: 'rgba(134, 239, 172, 0.08)',
              border: '1px solid rgba(134, 239, 172, 0.25)',
              color: '#86efac',
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            link sent to <strong>{email}</strong>. check your inbox — expires in 10 minutes.
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              autoFocus
              required
              autoComplete="email"
              style={{
                padding: '14px 16px',
                borderRadius: 10,
                background: 'var(--surface-2)',
                border: '1px solid var(--border-mid)',
                color: 'var(--ink)',
                fontSize: 15,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              style={{
                padding: '14px 20px',
                borderRadius: 10,
                background: accent,
                color: '#000',
                fontWeight: 700,
                fontSize: 15,
                border: '1.5px solid #000',
                boxShadow: '4px 4px 0 #000',
                cursor: status === 'sending' ? 'wait' : 'pointer',
                opacity: status === 'sending' ? 0.7 : 1,
              }}
            >
              {status === 'sending' ? 'sending...' : 'send sign-in link →'}
            </button>
            {status === 'error' && error && (
              <div
                style={{
                  fontSize: 13,
                  color: '#FF6B6B',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(255, 107, 107, 0.08)',
                  border: '1px solid rgba(255, 107, 107, 0.25)',
                }}
              >
                {error}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                margin: '4px 0',
              }}
            >
              <span style={{ flex: 1, height: 1, background: 'var(--border-soft)' }} />
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                  color: 'var(--text-40)',
                }}
              >
                or
              </span>
              <span style={{ flex: 1, height: 1, background: 'var(--border-soft)' }} />
            </div>
            <LinkedInComingSoonButton />
          </form>
        )}
      </div>
    </main>
  );
}

const LINKEDIN_BLUE = '#0A66C2';

function LinkedInMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
      />
    </svg>
  );
}

/** Placeholder until BetterAuth LinkedIn OAuth lands (#101). Not connectable yet. */
function LinkedInComingSoonButton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-label="log in with linkedin, coming soon"
        title="coming soon"
        data-testid="linkedin-signin-coming-soon"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          minHeight: 48,
          padding: '14px 20px',
          borderRadius: 10,
          background: LINKEDIN_BLUE,
          color: '#fff',
          fontWeight: 700,
          fontSize: 15,
          border: '1.5px solid #000',
          boxShadow: '4px 4px 0 #000',
          cursor: 'not-allowed',
          opacity: 0.55,
        }}
      >
        <LinkedInMark />
        log in with linkedin
      </button>
      <p
        className="mono"
        style={{
          margin: 0,
          textAlign: 'center',
          fontSize: 11,
          letterSpacing: 0.4,
          color: 'var(--text-40)',
        }}
      >
        coming soon
      </p>
    </div>
  );
}
