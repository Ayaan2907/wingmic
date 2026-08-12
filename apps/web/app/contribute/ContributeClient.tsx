// @ts-nocheck
/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import GitHubActivity from '../_components/GitHubActivity';

const REPO = 'Ayaan2907/wingmic';
const ACCENT = '#FFC452';

export default function ContributeClient() {
  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      {/* ─────── HEADER ─────── */}
      <nav className="wm-nav" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: ACCENT, color: '#000',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16,
          }}>W</div>
          <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: -0.5 }}>
            wingmic<span style={{ color: 'rgba(255,255,255,0.35)' }}>.xyz</span>
          </div>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="https://github.com/Ayaan2907/wingmic" target="_blank" rel="noreferrer" aria-label="wingmic on GitHub" style={{ color: 'rgba(255,255,255,0.55)', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .3a12 12 0 00-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.4-1.3-5.4-5.9 0-1.3.5-2.4 1.2-3.2-.1-.4-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.4 11.4 0 016 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.8.1 3.2.7.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0012 .3" /></svg>
          </a>
          <a href="https://x.com/wingmicxyz" target="_blank" rel="noreferrer" aria-label="wingmic on X" style={{ color: 'rgba(255,255,255,0.55)', display: 'flex' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 6h2.3l-5 5.7L20 18h-4.6l-3.6-4.7L7.6 18H5.3l5.4-6.1L5 6h4.7l3.3 4.3L16.5 6zm-.8 10.6h1.3L8.4 7.3H7l8.7 9.3z" /></svg>
          </a>
          <a href="/#waitlist" className="wm-nav-cta" style={{
            padding: '8px 16px', borderRadius: 8, background: '#fff', color: '#000',
            fontSize: 13.5, fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)',
          }}>Get beta access</a>
        </div>
      </nav>

      {/* ─────── CONTRIBUTE ─────── */}
      <section className="grid-bg wm-section" style={{ padding: '140px 32px 100px', minHeight: '100vh' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div className="mono" style={{ fontSize: 11, color: ACCENT, marginBottom: 18, letterSpacing: 2, textTransform: 'uppercase' }}>
            ◆ open source · MIT · issue-first
          </div>
          <h1 style={{ fontSize: 'clamp(40px, 6vw, 76px)', fontWeight: 900, lineHeight: 0.96, letterSpacing: '-0.04em', marginBottom: 20 }}>
            Open on <span className="serif" style={{ fontStyle: 'italic', fontWeight: 400, color: ACCENT }}>GitHub</span>.
          </h1>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55, maxWidth: 520, marginBottom: 44 }}>
            Live issues and pull requests, straight from the repo. Grab one, open a PR, ship it.
          </p>

          <GitHubActivity />

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginTop: 44 }}>
            <a href={`https://github.com/${REPO}/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22`} target="_blank" rel="noreferrer" style={{
              padding: '13px 22px', borderRadius: 10, background: ACCENT, color: '#000',
              fontSize: 14.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '3px 3px 0 #000', border: '1.5px solid #000',
            }}>
              Good first issues
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1 7h12m0 0L8 2m5 5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </a>
            <span className="mono" style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.4)' }}>
              version roadmap — coming soon
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
