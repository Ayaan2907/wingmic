// @ts-nocheck
/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useRef, useState } from 'react';

// Best-effort live X timeline via X's official widget script. A brand-new
// account (or a blocked script) renders nothing, so we fall back to a clean
// follow-on-X card. No API key, no secret — the widget is client-side only.
const HANDLE = 'wingmicxyz';
const ACCENT = '#FFC452';

export default function XActivity() {
  const containerRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ok | fallback

  useEffect(() => {
    let cancelled = false;
    const fail = () => { if (!cancelled) setStatus((s) => (s === 'ok' ? s : 'fallback')); };

    const build = () => {
      const twttr = window.twttr;
      if (!twttr?.widgets?.createTimeline || !containerRef.current) { fail(); return; }
      twttr.widgets
        .createTimeline(
          { sourceType: 'profile', screenName: HANDLE },
          containerRef.current,
          { theme: 'dark', height: 520, chrome: 'noheader nofooter noborders transparent', dnt: true },
        )
        .then((el) => { if (!cancelled) setStatus(el ? 'ok' : 'fallback'); })
        .catch(fail);
    };

    // If the widget hasn't resolved in time, drop to the CTA.
    const timeout = setTimeout(() => {
      if (!cancelled) setStatus((s) => (s === 'loading' ? 'fallback' : s));
    }, 6000);

    if (window.twttr?.widgets) {
      build();
    } else {
      let script = document.getElementById('twitter-wjs');
      if (!script) {
        script = document.createElement('script');
        script.id = 'twitter-wjs';
        script.src = 'https://platform.twitter.com/widgets.js';
        script.async = true;
        document.body.appendChild(script);
      }
      script.addEventListener('load', build);
      script.addEventListener('error', fail);
    }

    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);

  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden', minHeight: 320,
      background: '#08080d', border: '1px solid rgba(255,255,255,0.08)',
      position: 'relative',
    }}>
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M16.5 6h2.3l-5 5.7L20 18h-4.6l-3.6-4.7L7.6 18H5.3l5.4-6.1L5 6h4.7l3.3 4.3L16.5 6z" fill="#fff" /></svg>
        </div>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>@{HANDLE}</span>
        <span className="mono" style={{ fontSize: 10.5, color: status === 'ok' ? '#86efac' : 'rgba(255,255,255,0.35)', marginLeft: 'auto' }}>
          {status === 'ok' ? '● live' : status === 'loading' ? '○ loading' : '○ on X'}
        </span>
      </div>

      <div ref={containerRef} style={{ display: status === 'fallback' ? 'none' : 'block', padding: status === 'ok' ? 0 : 8 }} />

      {status === 'loading' && (
        <div className="mono" style={{ padding: 24, fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
          pulling the latest from X…
        </div>
      )}

      {status === 'fallback' && (
        <div style={{ padding: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 1.55, marginBottom: 20, maxWidth: 340, marginLeft: 'auto', marginRight: 'auto' }}>
            the live feed&apos;s still warming up. follow along on X — build notes, changelogs, and the occasional graph flex.
          </p>
          <a href={`https://x.com/${HANDLE}`} target="_blank" rel="noreferrer" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '11px 20px', borderRadius: 10, background: ACCENT, color: '#000',
            fontSize: 14, fontWeight: 700, boxShadow: '3px 3px 0 #000', border: '1.5px solid #000',
          }}>
            Follow @{HANDLE}
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1 7h12m0 0L8 2m5 5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </a>
        </div>
      )}
    </div>
  );
}
