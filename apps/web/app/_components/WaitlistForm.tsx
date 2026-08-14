// @ts-nocheck
'use client';

import { useState } from 'react';

// Waitlist endpoint — Formspree. Public by design (endpoint IDs are not secret).
// One shared form, reused by the landing #waitlist section and the demo frame.
const WAITLIST_ENDPOINT = 'https://formspree.io/f/meenaaqb';

export default function WaitlistForm({ accent = '#FFC452', source = 'wingmic.xyz', compact = false }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!email.includes('@')) {
      setErrorMsg('that does not look like a real email.');
      return;
    }
    setPending(true);
    setErrorMsg('');
    try {
      const res = await fetch(WAITLIST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, source }),
      });
      if (!res.ok) throw new Error(`formspree returned ${res.status}`);
      setSubmitted(true);
    } catch {
      setErrorMsg('could not reach the waitlist. try again in a moment.');
    } finally {
      setPending(false);
    }
  };

  // ── compact variant — pops into the demo frame after a run ──
  if (compact) {
    return (
      <div style={{ padding: 12, borderRadius: 12, background: `${accent}0d`, border: `1px solid ${accent}33` }}>
        {submitted ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#fff' }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', background: accent, color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>✓</span>
            you&apos;re on the list — we&apos;ll email you.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', marginBottom: 8 }}>want your own graph? <span style={{ color: accent }}>join the beta.</span></div>
            <form onSubmit={submit} style={{ display: 'flex', gap: 6 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (errorMsg) setErrorMsg(''); }}
                placeholder="you@email.com"
                style={{ flex: 1, minWidth: 0, padding: '9px 11px', borderRadius: 8, border: `1px solid ${errorMsg ? '#FF6B6B' : 'rgba(255,255,255,0.15)'}`, background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: 12.5, outline: 'none', fontFamily: 'inherit' }}
              />
              <button type="submit" disabled={pending} style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: accent, color: '#000', fontSize: 12.5, fontWeight: 700, cursor: pending ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>{pending ? '…' : 'join →'}</button>
            </form>
            {errorMsg && <div className="mono" style={{ fontSize: 10.5, color: '#FF6B6B', marginTop: 6 }}>{errorMsg}</div>}
          </>
        )}
      </div>
    );
  }

  // ── full variant — landing #waitlist section ──
  return (
    <>
      {!submitted ? (
        <form onSubmit={submit} className="wm-waitlist-form" style={{
          display: 'flex', gap: 8, padding: 6, borderRadius: 12,
          background: '#0a0a0a', border: `1.5px solid ${accent}50`,
          maxWidth: 500, margin: '0 auto', boxShadow: `4px 4px 0 ${accent}30`,
        }}>
          <input
            type="email" placeholder="you@email.com" value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ flex: 1, padding: '14px 16px', background: 'transparent', border: 'none', color: '#fff', fontSize: 15, outline: 'none', fontFamily: 'inherit' }}
          />
          <button type="submit" disabled={pending} style={{
            padding: '14px 26px', borderRadius: 8, background: accent, color: '#000',
            fontSize: 14, fontWeight: 700, border: 'none', cursor: pending ? 'wait' : 'pointer',
            opacity: pending ? 0.6 : 1, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            {pending ? 'Sending…' : 'Request access'}
            {!pending && <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7h12m0 0L8 2m5 5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>}
          </button>
        </form>
      ) : (
        <div style={{ padding: 24, borderRadius: 12, maxWidth: 500, margin: '0 auto', background: `${accent}10`, border: `1px solid ${accent}40` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l3.5 3.5L11 4" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div style={{ fontSize: 16, color: '#fff' }}>You&apos;re on the list. We&apos;ll email you within a week.</div>
          </div>
        </div>
      )}
      {errorMsg && (
        <div className="mono" style={{ fontSize: 12, color: '#FF6B6B', marginTop: 14, letterSpacing: 0.5, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto', textAlign: 'center' }}>
          {errorMsg}
        </div>
      )}
    </>
  );
}
