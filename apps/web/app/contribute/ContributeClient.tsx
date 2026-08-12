// @ts-nocheck
/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import GitHubActivity from '../_components/GitHubActivity';
import XActivity from '../_components/XActivity';

const REPO = 'Ayaan2907/wingmic';
const ACCENT = '#FFC452';
const SECOND = '#86efac';
const THIRD = '#FF8FAB';

// Version plan — kept short on purpose; deep detail is "coming soon".
const ROADMAP = [
  {
    tag: 'v0.1.2', when: 'shipped', color: SECOND,
    title: 'chat + capture + entity pages',
    body: 'one-mic capture in /chat, the global capture provider, and person / company / event detail pages.',
  },
  {
    tag: 'v0.1.x', when: 'in progress', color: ACCENT,
    title: 'sharper capture loop',
    body: 'lazy promotion, a confidence prompt, a text-input fallback, and the first integration test.',
    issues: [2, 3, 5, 8, 9],
  },
  {
    tag: 'v0.2', when: 'next', color: '#7DD3FC',
    title: 'contact imports',
    body: 'connect a source once — dedupe, enrich, and weave existing contacts into the graph.',
    issues: [10],
  },
  {
    tag: 'v0.3', when: 'planned', color: '#A78BFA',
    title: 'the acts agent',
    body: 'with your permission, wingmic drafts the follow-up, schedules the reminder, sends the intro.',
    issues: [11],
  },
];

function HeaderLink({ href, children, external }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.55)' }}
    >{children}</a>
  );
}

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
        <div className="wm-nav-links" style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
          <HeaderLink href="/#how">How</HeaderLink>
          <HeaderLink href="/#api">API</HeaderLink>
          <HeaderLink href={`https://github.com/${REPO}`} external>GitHub</HeaderLink>
          <HeaderLink href="https://x.com/wingmicxyz" external>X</HeaderLink>
        </div>
        <a href="/#waitlist" className="wm-nav-cta" style={{
          padding: '8px 16px', borderRadius: 8, background: '#fff', color: '#000',
          fontSize: 13.5, fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)',
        }}>Get beta access</a>
      </nav>

      {/* ─────── HERO ─────── */}
      <section className="grid-bg wm-section" style={{ padding: '140px 32px 80px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="mono" style={{ fontSize: 11, color: ACCENT, marginBottom: 20, letterSpacing: 2, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT, animation: 'pulse-d 1.5s infinite' }} />
            open source · MIT @ GA · issue-first
          </div>
          <h1 style={{ fontSize: 'clamp(44px, 7vw, 92px)', fontWeight: 900, lineHeight: 0.94, letterSpacing: '-0.04em', marginBottom: 24, maxWidth: 900 }}>
            Build wingmic{' '}
            <span className="serif" style={{ fontStyle: 'italic', fontWeight: 400, color: ACCENT }}>with us</span>.
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55, maxWidth: 560, marginBottom: 32 }}>
            Every change maps to an open issue. Grab one, open a PR, ship it. Below is what&apos;s live on GitHub right now, where the versions are headed, and where we post along the way.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href={`https://github.com/${REPO}/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22`} target="_blank" rel="noreferrer" style={{
              padding: '14px 24px', borderRadius: 10, background: ACCENT, color: '#000',
              fontSize: 15, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '4px 4px 0 #000', border: '1.5px solid #000',
            }}>
              Good first issues
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7h12m0 0L8 2m5 5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </a>
            <a href={`https://github.com/${REPO}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noreferrer" style={{
              padding: '14px 24px', borderRadius: 10, background: 'transparent', color: '#fff',
              fontSize: 15, fontWeight: 600, border: '1.5px solid rgba(255,255,255,0.25)',
            }}>Read CONTRIBUTING →</a>
          </div>
        </div>
      </section>

      {/* ─────── LIVE GITHUB + X ─────── */}
      <section className="wm-section" style={{ padding: '80px 32px', background: '#06060a', borderTop: `2px solid ${ACCENT}30` }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="wm-stack" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 48, alignItems: 'start' }}>
            <div>
              <div className="mono" style={{ fontSize: 11, color: ACCENT, marginBottom: 14, letterSpacing: 2, textTransform: 'uppercase' }}>
                ◆ Live on GitHub
              </div>
              <h2 className="wm-section-h2" style={{ fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.02, marginBottom: 24 }}>
                What&apos;s <span className="serif" style={{ fontStyle: 'italic', fontWeight: 400, color: ACCENT }}>open</span> right now.
              </h2>
              <GitHubActivity />
            </div>
            <div>
              <div className="mono" style={{ fontSize: 11, color: THIRD, marginBottom: 14, letterSpacing: 2, textTransform: 'uppercase' }}>
                ◆ On X
              </div>
              <h2 className="wm-section-h2" style={{ fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.02, marginBottom: 24 }}>
                Build in the <span className="serif" style={{ fontStyle: 'italic', fontWeight: 400, color: THIRD }}>open</span>.
              </h2>
              <XActivity />
            </div>
          </div>
        </div>
      </section>

      {/* ─────── ROADMAP ─────── */}
      <section className="wm-section" style={{ padding: '100px 32px', background: '#0a0a0a', borderTop: `2px solid ${ACCENT}30` }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="mono" style={{ fontSize: 11, color: ACCENT, marginBottom: 14, letterSpacing: 2, textTransform: 'uppercase' }}>
            ◆ Where it&apos;s headed
          </div>
          <h2 className="wm-section-h2" style={{ fontSize: 'clamp(32px, 5vw, 60px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 16 }}>
            The <span className="serif" style={{ fontStyle: 'italic', fontWeight: 400, color: ACCENT }}>roadmap</span>.
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', maxWidth: 560, marginBottom: 56 }}>
            The shape of the next few versions. Deeper plans — specs, milestones, dates — coming soon.
          </p>

          <div className="wm-stack-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {ROADMAP.map((r) => (
              <div key={r.tag} style={{
                padding: 22, borderRadius: 14, display: 'flex', flexDirection: 'column',
                background: 'rgba(255,255,255,0.025)', border: `1px solid ${r.color}30`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: r.color }}>{r.tag}</span>
                  <span className="mono" style={{
                    fontSize: 9.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                    color: r.color, padding: '2px 7px', borderRadius: 4,
                    background: `${r.color}15`, border: `1px solid ${r.color}40`,
                  }}>{r.when}</span>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8, lineHeight: 1.2 }}>{r.title}</h3>
                <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, flex: 1 }}>{r.body}</p>
                {r.issues && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                    {r.issues.map((n) => (
                      <a key={n} href={`https://github.com/${REPO}/issues/${n}`} target="_blank" rel="noreferrer" className="mono" style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 999, color: 'rgba(255,255,255,0.7)',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                      }}>#{n}</a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* coming-soon banner */}
          <div style={{
            marginTop: 28, padding: 24, borderRadius: 14,
            background: `${ACCENT}08`, border: `1px dashed ${ACCENT}40`,
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          }}>
            <span className="mono" style={{ fontSize: 11, color: ACCENT, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700 }}>
              ◆ Coming soon
            </span>
            <span style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.7)', flex: 1, minWidth: 240 }}>
              A full version plan with specs and milestones lands here shortly. Want to shape it? The issue tree is open.
            </span>
            <a href={`https://github.com/${REPO}/issues`} target="_blank" rel="noreferrer" style={{ fontSize: 13.5, color: ACCENT, fontWeight: 600 }}>
              Open the issue tree →
            </a>
          </div>
        </div>
      </section>

      {/* ─────── HOW TO HELP ─────── */}
      <section className="wm-section" style={{ padding: '100px 32px', background: '#06060a', borderTop: `2px solid ${ACCENT}30` }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div className="mono" style={{ fontSize: 11, color: SECOND, marginBottom: 14, letterSpacing: 2, textTransform: 'uppercase' }}>
            ◆ How to help
          </div>
          <h2 className="wm-section-h2" style={{ fontSize: 'clamp(32px, 5vw, 60px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 56 }}>
            Three steps to your <span className="serif" style={{ fontStyle: 'italic', fontWeight: 400, color: SECOND }}>first PR</span>.
          </h2>
          <div className="wm-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              { n: '01', title: 'Pick an issue', body: 'Start with a good-first-issue, or claim any open one. No issue for your idea? File one first — that\'s the workflow.', href: `https://github.com/${REPO}/issues`, cta: 'Browse issues' },
              { n: '02', title: 'Open a PR', body: 'One change per PR. Conventional commits, CI green (typecheck · lint · vitest · build), tests with new code.', href: `https://github.com/${REPO}/blob/main/CONTRIBUTING.md`, cta: 'Read the guide' },
              { n: '03', title: 'Ship it', body: 'Two external reviewers pass every diff. Merge, and it\'s in the next release — MIT, credited, public.', href: `https://github.com/${REPO}/pulls`, cta: 'See open PRs' },
            ].map((s) => (
              <div key={s.n} style={{
                padding: 28, borderRadius: 16,
                background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', flexDirection: 'column',
              }}>
                <span className="serif" style={{ fontSize: 72, fontStyle: 'italic', color: SECOND, lineHeight: 0.9, letterSpacing: '-0.04em', marginBottom: 12 }}>{s.n}</span>
                <h3 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 10 }}>{s.title}</h3>
                <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55, marginBottom: 18, flex: 1 }}>{s.body}</p>
                <a href={s.href} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 12.5, color: SECOND, fontWeight: 600 }}>{s.cta} →</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────── FOOTER ─────── */}
      <footer className="wm-section" style={{ padding: '48px 32px 40px', borderTop: '1px solid rgba(255,255,255,0.06)', background: '#0a0a0a' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <a href="/" className="mono" style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>← back to wingmic.xyz</a>
          <div style={{ display: 'flex', gap: 20 }}>
            <a href={`https://github.com/${REPO}`} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>GitHub</a>
            <a href="https://x.com/wingmicxyz" target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>X</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
