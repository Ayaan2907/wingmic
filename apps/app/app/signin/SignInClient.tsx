'use client';

import { use, useState, type FormEvent } from 'react';
import { signIn } from '@/lib/auth-client';

type Status = 'idle' | 'sending' | 'sent' | 'error';

const accent = '#FFC452';

export default function SignInClient({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ next?: string }>;
}) {
  const sp = use(searchParamsPromise);
  const next = sp?.next ?? '/capture';

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
          </form>
        )}
      </div>
    </main>
  );
}
