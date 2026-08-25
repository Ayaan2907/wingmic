'use client';

import { useState, type FormEvent } from 'react';

// Same magic-link send the app's /signin page performs, fired straight from
// the landing (issue #169). The app allows this origin via CORS; the send
// sets no cookie, so no credentials are involved.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3211';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function MagicLinkForm({ accent = '#FFC452' }: { accent?: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes('@') || status === 'sending') return;
    setStatus('sending');
    try {
      const res = await fetch(`${APP_URL}/api/auth/sign-in/magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, callbackURL: '/chat' }),
      });
      if (!res.ok) throw new Error(`auth returned ${res.status}`);
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div style={{
        padding: '16px 18px', borderRadius: 10, textAlign: 'left',
        background: 'rgba(134, 239, 172, 0.08)', border: '1px solid rgba(134, 239, 172, 0.25)',
        color: '#86efac', fontSize: 14.5, lineHeight: 1.5,
      }}>
        link sent to <strong>{email}</strong> — check your inbox. it signs you in for 30 days and expires in 10 minutes.
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="wm-magic-row" style={{ display: 'flex', gap: 10 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@domain.com"
          required
          autoComplete="email"
          aria-label="email for sign-in link"
          style={{
            flex: 1, minWidth: 0, padding: '13px 16px', borderRadius: 10,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', fontSize: 15, fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={status === 'sending'}
          style={{
            padding: '13px 22px', borderRadius: 10, whiteSpace: 'nowrap',
            background: accent, color: '#000', fontWeight: 700, fontSize: 15,
            border: '1.5px solid #000', boxShadow: '3px 3px 0 #000',
            cursor: status === 'sending' ? 'wait' : 'pointer',
            opacity: status === 'sending' ? 0.7 : 1,
          }}
        >
          {status === 'sending' ? 'sending…' : 'get started'}
        </button>
      </div>
      {status === 'error' && (
        <div style={{
          fontSize: 13, color: '#FF6B6B', padding: '8px 12px', borderRadius: 8, textAlign: 'left',
          background: 'rgba(255, 107, 107, 0.08)', border: '1px solid rgba(255, 107, 107, 0.25)',
        }}>
          couldn&apos;t reach the app —{' '}
          <a
            href={`${APP_URL}/signin?email=${encodeURIComponent(email)}`}
            style={{ color: '#FF6B6B', fontWeight: 600, textDecoration: 'underline' }}
          >
            open the sign-in page →
          </a>
        </div>
      )}
    </form>
  );
}
