// library/lib-desktop.jsx — desktop variants of the mobile screens
(function () {
  const T = window.WMT;
  const { Pill, Avatar, EntityTag, VoiceBars, Icon, MicroLabel } = window;
  const { MicOrb } = window;

  // ─────────────────────────────────────────────────────────────────────
  // Desktop frame: macOS-style window
  // ─────────────────────────────────────────────────────────────────────
  function DesktopFrame({ children, url = 'wingmic.xyz/app' }) {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        background: '#0a0a0a',
        backgroundImage:
          'radial-gradient(ellipse at 18% 0%, rgba(255,196,82,0.04) 0%, transparent 55%),' +
          'radial-gradient(ellipse at 82% 100%, rgba(255,107,107,0.025) 0%, transparent 55%)',
        padding: 24,
      }}>
        <div style={{
          width: '100%', height: '100%',
          borderRadius: 14, overflow: 'hidden',
          background: T.color.bg, border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Title bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['#ff5f56','#ffbd2e','#27ca3f'].map(c => (
                <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />
              ))}
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <div style={{
                padding: '4px 16px', borderRadius: 6,
                background: 'rgba(255,255,255,0.04)',
                font: `500 11.5px ${T.font.mono}`, color: T.color.t55, letterSpacing: 0.3,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ color: T.color.second, fontSize: 10 }}>●</span>
                {url}
              </div>
            </div>
            <div style={{ width: 60 }} />
          </div>
          <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
            {children}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // Persistent left rail (replaces mobile bottom nav on desktop)
  // ─────────────────────────────────────────────────────────────────────
  function Sidebar({ active = 'home' }) {
    const items = [
      { k: 'home',  icon: 'home',  label: 'home',    badge: null },
      { k: 'chat',  icon: 'chat',  label: 'chat',    badge: null },
      { k: 'graph', icon: 'graph', label: 'graph',   badge: null },
      { k: 'acts',  icon: 'bell',  label: 'acts',    badge: '5' },
      { k: 'search', icon: 'search', label: 'search', badge: null },
    ];
    return (
      <aside style={{
        width: 248, flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.015)',
        display: 'flex', flexDirection: 'column',
        padding: '22px 14px 18px',
      }}>
        {/* Logo */}
        <div style={{ padding: '0 8px 22px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, background: '#0a0a0a',
            border: `1px solid ${T.color.accent}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="mic" size={16} color={T.color.accent} />
          </div>
          <span style={{ font: `800 16px ${T.font.sans}`, letterSpacing: '-0.02em', color: T.color.ink }}>
            wingmic<span style={{ color: T.color.accent }}>.xyz</span>
          </span>
        </div>

        {/* Capture CTA (the mic — same destination as on mobile) */}
        <button style={{
          margin: '0 6px 18px',
          padding: '13px 16px', borderRadius: 12,
          background: T.color.accent, color: '#000',
          border: '1.5px solid #000', boxShadow: '4px 4px 0 #000',
          font: `700 14px ${T.font.sans}`,
          display: 'flex', alignItems: 'center', gap: 10,
          cursor: 'pointer', justifyContent: 'space-between',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <Icon name="mic" size={18} color="#000" />
            Hold to capture
          </span>
          <span style={{ font: `600 10px ${T.font.mono}`, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.15)', letterSpacing: 0.5 }}>⌘ K</span>
        </button>

        {/* Nav */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map(it => {
            const isActive = active === it.k;
            return (
              <button key={it.k} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 8,
                background: isActive ? 'rgba(255,196,82,0.08)' : 'transparent',
                border: isActive ? `1px solid ${T.color.accent}30` : '1px solid transparent',
                color: isActive ? T.color.accent : T.color.t70,
                font: `500 14px ${T.font.sans}`,
                cursor: 'pointer', textAlign: 'left',
              }}>
                <Icon name={it.icon} size={18} color={isActive ? T.color.accent : T.color.t55} />
                <span style={{ flex: 1 }}>{it.label}</span>
                {it.badge && (
                  <span style={{
                    padding: '2px 6px', borderRadius: 999,
                    background: T.color.accent, color: '#000',
                    font: `700 9.5px ${T.font.mono}`, letterSpacing: 0.4,
                  }}>{it.badge}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Section: pinned people */}
        <div style={{ padding: '22px 8px 8px' }}>
          <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span>◆ pinned</span>
            <span style={{ color: T.color.t40 }}>3</span>
          </div>
          {[
            { name: 'Sarah Chen',   org: 'Acme · rust',     c: T.color.accent },
            { name: 'Marcus Rivera', org: 'Dataweave · cto', c: T.color.blue },
            { name: 'Priya Sharma',  org: 'NeuralPath · ml', c: T.color.violet },
          ].map(p => (
            <div key={p.name} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
            }}>
              <Avatar name={p.name} size={26} color={p.c} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: `500 12.5px ${T.font.sans}`, color: T.color.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                <div style={{ font: `400 10.5px ${T.font.mono}`, color: T.color.t40, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{p.org}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Profile footer */}
        <div style={{
          padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Avatar name="Morgan" size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: `600 12px ${T.font.sans}`, color: T.color.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Morgan Lee</div>
            <div style={{ font: `400 10px ${T.font.mono}`, color: T.color.t40, letterSpacing: 0.3 }}>pro · 1,247 nodes</div>
          </div>
          <Icon name="settings" size={14} color={T.color.t40} />
        </div>
      </aside>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // 1. DESKTOP HOME — dashboard grid
  // ─────────────────────────────────────────────────────────────────────
  function ScreenDesktopHome() {
    return (
      <DesktopFrame>
        <Sidebar active="home" />
        <main style={{ flex: 1, padding: '28px 36px', overflowY: 'auto' }}>
          {/* header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
            <div>
              <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>◆ today · mon · oct 21</div>
              <h1 style={{ margin: 0, font: `900 44px/1 ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.035em' }}>
                morning, <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>morgan</i>.
              </h1>
              <p style={{ margin: '8px 0 0', font: `400 15px ${T.font.sans}`, color: T.color.t55 }}>
                The agent did its sweep at 06:12. Five drafts waiting.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 8,
                background: 'rgba(134,239,172,0.08)', border: `1px solid ${T.color.second}40`,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.color.second, animation: 'wm-pulse-d 1.6s infinite' }} />
                <span style={{ font: `500 11px ${T.font.mono}`, color: T.color.second, letterSpacing: 0.4 }}>graph synced</span>
              </div>
            </div>
          </div>

          {/* stats trio */}
          <div style={{ display: 'flex', gap: 32, marginBottom: 30 }}>
            {[
              { v: '12', l: 'people met', s: 'last 30d', c: T.color.accent, r: -2 },
              { v: '3',  l: 'acts pending', s: 'drafted', c: T.color.second, r: 1 },
              { v: '4',  l: 'commits today', s: 'extracted', c: T.color.third, r: -1 },
              { v: '92%', l: 'recall', s: 'when asked', c: T.color.blue, r: 1.5 },
            ].map((s, i) => (
              <div key={i} style={{ transform: `rotate(${s.r}deg)` }}>
                <div style={{ font: `400 84px/0.85 ${T.font.serif}`, fontStyle: 'italic', color: s.c, letterSpacing: '-0.04em' }}>{s.v}</div>
                <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 8 }}>{s.l}</div>
                <div style={{ font: `400 12.5px ${T.font.sans}`, color: T.color.t55, marginTop: 4 }}>{s.s}</div>
              </div>
            ))}
          </div>

          {/* 2-column body */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 22 }}>
            {/* Acts queue */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase' }}>◆ acts · pending</div>
                <span style={{ font: `500 11.5px ${T.font.mono}`, color: T.color.t40 }}>see all 5 →</span>
              </div>
              {[
                { kind: 'check-in', glyph: '↗', name: 'Sarah Chen', why: '7d since DevConnect — you owe her the edge-reload repo.', conf: 92, color: T.color.accent, ch: '✉ email', org: 'Acme · Rust Lead' },
                { kind: 'reminder', glyph: '◷', name: 'Marcus Rivera', why: 'Coffee Mon — no calendar invite sent yet.', conf: 88, color: T.color.blue, ch: '◷ calendar', org: 'Dataweave · CTO' },
                { kind: 'intro',    glyph: '⇌', name: 'Priya → Deepak', why: 'Both work on voice + MCP. Priya needs MCP help.', conf: 74, color: T.color.violet, ch: '✉ email', org: 'NeuralPath ↔ OpenAI' },
              ].map((a, i) => (
                <div key={i} style={{
                  padding: 16, marginBottom: 8, borderRadius: 14,
                  background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <Avatar name={a.name} size={44} square color={a.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ font: `700 10px ${T.font.mono}`, color: a.color, letterSpacing: 0.6, textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, background: `${a.color}18`, border: `1px solid ${a.color}30` }}>{a.glyph} {a.kind}</span>
                      <span style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.t40 }}>{a.ch} · {a.conf}%</span>
                    </div>
                    <div style={{ font: `700 15px ${T.font.sans}`, color: T.color.ink }}>{a.name}</div>
                    <div style={{ font: `400 12.5px ${T.font.sans}`, color: T.color.t55, marginTop: 2 }}>{a.why}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button style={{ padding: '10px 18px', borderRadius: 10, background: T.color.accent, color: '#000', border: '1.5px solid #000', boxShadow: '3px 3px 0 #000', font: `700 12.5px ${T.font.sans}`, cursor: 'pointer', whiteSpace: 'nowrap' }}>Send →</button>
                    <button style={{ padding: '6px 10px', borderRadius: 8, background: 'transparent', color: T.color.t55, border: '1px solid rgba(255,255,255,0.1)', font: `500 11px ${T.font.mono}`, cursor: 'pointer', letterSpacing: 0.3 }}>edit</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Sidebar: graph preview + commits */}
            <div>
              {/* Graph preview */}
              <div style={{
                padding: 16, marginBottom: 14, borderRadius: 14,
                background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                  <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase' }}>◆ graph preview</div>
                  <span style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40 }}>open →</span>
                </div>
                <div style={{ height: 200, position: 'relative', overflow: 'hidden', borderRadius: 8 }}>
                  <svg viewBox="0 0 360 200" style={{ width: '100%', height: '100%' }}>
                    {[[60,40],[280,40],[300,140],[200,170],[80,160],[180,30],[140,90]].map(([x,y], i) => (
                      <line key={i} x1={180} y1={100} x2={x} y2={y} stroke="rgba(255,196,82,0.18)" strokeWidth="1" />
                    ))}
                    <circle cx="180" cy="100" r="14" fill={T.color.accent} />
                    <text x="180" y="105" textAnchor="middle" fontFamily={T.font.sans} fontSize="10" fontWeight="800" fill="#000">You</text>
                    {[[60,40,T.color.accent,'sarah'],[280,40,T.color.blue,'marcus'],[300,140,T.color.violet,'priya'],[200,170,T.color.third,'alex'],[80,160,T.color.second,'jordan'],[180,30,T.color.t40,'dev'],[140,90,T.color.blue,'acme']].map(([x,y,c,l], i) => (
                      <g key={i}>
                        <circle cx={x} cy={y} r="8" fill={c} opacity="0.85" />
                        <text x={x} y={y + 20} textAnchor="middle" fontFamily={T.font.mono} fontSize="9" fill="rgba(255,255,255,0.55)">{l}</text>
                      </g>
                    ))}
                  </svg>
                </div>
              </div>

              {/* Recent commits */}
              <div style={{
                padding: '6px 16px', borderRadius: 14,
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t55, letterSpacing: 2, textTransform: 'uppercase', padding: '10px 0' }}>◆ recent commits</div>
                {[
                  { who: 'sarah_chen',   d: 'met @ DevConnect · 4 edges',   t: '14:32', c: T.color.accent },
                  { who: 'marcus_rivera', d: 'coffee scheduled · mon 9am',  t: '15:10', c: T.color.blue },
                  { who: 'priya_sharma', d: 'diarization paper attached',   t: '16:45', c: T.color.violet },
                  { who: 'agent',        d: 'drafted check-in to sarah',    t: '06:12', c: T.color.second },
                ].map((r, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                    borderTop: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.c, animation: 'wm-pulse-d 1.6s infinite' }} />
                    <span style={{ font: `500 10.5px ${T.font.mono}`, color: r.c, minWidth: 80, letterSpacing: 0.3 }}>{r.who}</span>
                    <span style={{ flex: 1, font: `400 12.5px ${T.font.sans}`, color: T.color.t70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.d}</span>
                    <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30 }}>{r.t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </DesktopFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // 2. DESKTOP CHAT — thread + entity rail
  // ─────────────────────────────────────────────────────────────────────
  function ScreenDesktopChat() {
    return (
      <DesktopFrame url="wingmic.xyz/chat">
        <Sidebar active="chat" />
        <main style={{ flex: 1, display: 'flex', minWidth: 0 }}>
          {/* Thread */}
          <section style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ padding: '16px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name="W" size={36} square color={T.color.accent} />
              <div style={{ flex: 1 }}>
                <div style={{ font: `700 15px ${T.font.sans}`, color: T.color.ink }}>wingmic</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.color.second, animation: 'wm-pulse-d 1.6s infinite' }} />
                  <span style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.t40, letterSpacing: 0.4 }}>reading 1,247 nodes · synced</span>
                </div>
              </div>
              <button style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', color: T.color.t70, border: '1px solid rgba(255,255,255,0.12)', font: `500 12px ${T.font.mono}`, letterSpacing: 0.3, cursor: 'pointer' }}>clear thread</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 110px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ textAlign: 'center', font: `500 10px ${T.font.mono}`, color: T.color.t30, letterSpacing: 2, textTransform: 'uppercase', margin: '0 0 18px' }}>— today · 14:30 —</div>

              {/* You */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <div style={{ textAlign: 'right', maxWidth: 460 }}>
                  <div style={{
                    display: 'inline-block', textAlign: 'left',
                    padding: '12px 16px', borderRadius: '18px 18px 4px 18px',
                    background: T.color.accent, color: '#000',
                    font: `500 14.5px/1.45 ${T.font.sans}`,
                    border: '1.5px solid #000', boxShadow: '3px 3px 0 #000',
                  }}>who was the rust person at acme?</div>
                  <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30, marginTop: 6, letterSpacing: 0.5 }}>14:32 · you</div>
                </div>
              </div>

              {/* Agent */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <Avatar name="W" size={32} square color={T.color.accent} />
                <div style={{ flex: 1, maxWidth: 520 }}>
                  <div style={{
                    padding: '14px 18px', borderRadius: '4px 16px 16px 16px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: T.color.t85, font: `400 15px/1.6 ${T.font.sans}`,
                  }}>
                    <span style={{ color: T.color.accent, fontWeight: 600 }}>Sarah Chen</span> — Rust Lead at <span style={{ color: T.color.blue }}>Acme</span>. You met at <span style={{ color: T.color.t40 }}>DevConnect</span> on Oct 14. She talked edge-config and hot-reloading, and you said you'd send your <span style={{ fontFamily: T.font.mono, color: T.color.accent }}>edge-reload</span> repo. <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>You haven't, yet.</i>
                  </div>
                  <div style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.t30, marginTop: 8, letterSpacing: 0.4 }}>
                    ↪ sourced from voice note 14:32 · 3 commits · 1 follow-up
                  </div>
                </div>
              </div>

              {/* Suggested action */}
              <div style={{ marginLeft: 44, display: 'flex', gap: 8, marginBottom: 18 }}>
                <button style={{
                  padding: '10px 16px', borderRadius: 999,
                  background: T.color.accent, color: '#000',
                  font: `700 13px ${T.font.sans}`, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000',
                  cursor: 'pointer',
                }}>Draft follow-up to Sarah →</button>
                <button style={{
                  padding: '10px 14px', borderRadius: 999,
                  background: 'transparent', color: T.color.t70,
                  font: `500 12.5px ${T.font.mono}`, border: '1px solid rgba(255,255,255,0.15)',
                  cursor: 'pointer', letterSpacing: 0.3,
                }}>open her card</button>
              </div>

              {/* You · voice */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 12,
                    padding: '11px 16px', borderRadius: '18px 18px 4px 18px',
                    background: T.color.accent, color: '#000',
                    border: '1.5px solid #000', boxShadow: '3px 3px 0 #000',
                  }}>
                    <button style={{ width: 28, height: 28, borderRadius: '50%', background: '#000', color: T.color.accent, border: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▶</button>
                    <VoiceBars active count={16} height={20} width={2} gap={2} color="#000" />
                    <span style={{ font: `700 11px ${T.font.mono}`, letterSpacing: 0.4 }}>0:12</span>
                  </div>
                  <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30, marginTop: 6 }}>14:34 · you · voice</div>
                </div>
              </div>

              {/* Agent streaming */}
              <div style={{ display: 'flex', gap: 12 }}>
                <Avatar name="W" size={32} square color={T.color.accent} />
                <div style={{ flex: 1, maxWidth: 520 }}>
                  <div style={{
                    padding: '14px 18px', borderRadius: '4px 16px 16px 16px',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: T.color.t85, font: `400 15px/1.6 ${T.font.sans}`,
                  }}>
                    Reading your voice note. I heard: "met sarah from acme, she's their rust lead"<span style={{ display: 'inline-block', width: 2, height: 16, background: T.color.accent, marginLeft: 2, verticalAlign: 'text-bottom', animation: 'wm-blink 0.7s step-end infinite' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Composer */}
            <div style={{ position: 'absolute', left: 248 + 28, right: 320 + 28, bottom: 24 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 10px 10px 18px', borderRadius: 999,
                background: 'rgba(20,20,22,0.85)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 14px 30px rgba(0,0,0,0.5)',
              }}>
                <button style={{ width: 34, height: 34, borderRadius: '50%', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Icon name="plus" size={16} color={T.color.t70} />
                </button>
                <span style={{ flex: 1, font: `400 14.5px ${T.font.sans}`, color: T.color.t40 }}>ask wingmic, or hold the mic to capture a new contact…</span>
                <span style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40, padding: '3px 7px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)' }}>⌘ K</span>
                <button style={{ width: 44, height: 44, borderRadius: '50%', background: T.color.accent, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Icon name="mic" size={18} color="#000" />
                </button>
              </div>
            </div>
          </section>

          {/* Entity rail */}
          <aside style={{ width: 320, flexShrink: 0, padding: '20px 22px', overflowY: 'auto' }}>
            <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>◆ in this thread</div>

            {/* Active person */}
            <div style={{
              padding: 14, borderRadius: 14, marginBottom: 14,
              background: 'rgba(255,196,82,0.06)', border: `1px solid ${T.color.accent}40`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <Avatar name="Sarah" size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: `700 14px ${T.font.sans}`, color: T.color.ink }}>Sarah Chen</div>
                  <div style={{ font: `400 11.5px ${T.font.mono}`, color: T.color.t55, marginTop: 2 }}>Rust Lead · Acme · 5 edges</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <Pill size="sm">#engineering</Pill>
                <Pill size="sm">#rust</Pill>
                <Pill size="sm" color={T.color.accent}>follow-up</Pill>
              </div>
            </div>

            {/* Entities */}
            <div style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.t55, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>extracted</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 18 }}>
              <EntityTag kind="person">Sarah Chen</EntityTag>
              <EntityTag kind="company">Acme Corp</EntityTag>
              <EntityTag kind="event">DevConnect 2026</EntityTag>
              <EntityTag kind="concept">edge config</EntityTag>
              <EntityTag kind="concept">hot reloading</EntityTag>
            </div>

            <div style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.t55, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>sources</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { t: 'voice note · 14:32', d: 'DevConnect — sarah talked rust' },
                { t: 'commit · oct 14',    d: '4 edges added' },
                { t: 'follow-up · open',   d: 'send edge-reload repo' },
              ].map(s => (
                <div key={s.t} style={{ padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ font: `600 10.5px ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.3 }}>↪ {s.t}</div>
                  <div style={{ font: `400 12px ${T.font.sans}`, color: T.color.t70, marginTop: 2 }}>{s.d}</div>
                </div>
              ))}
            </div>
          </aside>
        </main>
      </DesktopFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // 3. DESKTOP GRAPH — full canvas + detail pane
  // ─────────────────────────────────────────────────────────────────────
  function ScreenDesktopGraph() {
    return (
      <DesktopFrame url="wingmic.xyz/graph">
        <Sidebar active="graph" />
        <main style={{ flex: 1, display: 'flex', minWidth: 0 }}>
          {/* Canvas */}
          <section style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {/* Toolbar overlay */}
            <div style={{ position: 'absolute', top: 22, left: 28, right: 28, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
              <div>
                <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>◆ graph</div>
                <div style={{ font: `800 28px/1 ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.025em' }}>
                  everyone <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>you know</i>
                </div>
                <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40, marginTop: 6, letterSpacing: 0.5 }}>
                  <span style={{ color: T.color.accent }}>12</span> people · <span style={{ color: T.color.blue }}>5</span> orgs · <span style={{ color: T.color.t55 }}>3</span> events · <span style={{ color: T.color.violet }}>18</span> concepts
                </div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 10,
                background: 'rgba(20,20,22,0.85)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <Icon name="search" size={16} color={T.color.t55} />
                <span style={{ font: `400 13px ${T.font.sans}`, color: T.color.t40, minWidth: 180 }}>filter the graph…</span>
                <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40, padding: '3px 7px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)' }}>⌘ F</span>
              </div>
            </div>

            {/* Filter chips */}
            <div style={{ position: 'absolute', top: 110, left: 28, zIndex: 10, display: 'flex', gap: 6 }}>
              {[
                { l: '◉ people · 12', on: true,  c: T.color.accent },
                { l: '▤ orgs · 5',    on: true,  c: T.color.blue },
                { l: '◆ events · 3',  on: true,  c: T.color.t40 },
                { l: '◇ topics · 18', on: false, c: T.color.violet },
              ].map((f, i) => (
                <span key={i} style={{
                  padding: '7px 12px', borderRadius: 999,
                  background: f.on ? `${f.c}1f` : 'rgba(255,255,255,0.03)',
                  color: f.on ? f.c : T.color.t40,
                  border: `1px solid ${f.on ? f.c + '40' : 'rgba(255,255,255,0.08)'}`,
                  font: `600 11px ${T.font.mono}`, letterSpacing: 0.5, textTransform: 'uppercase',
                }}>{f.l}</span>
              ))}
            </div>

            {/* Big SVG graph */}
            <svg viewBox="0 0 800 540" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <defs>
                <radialGradient id="dgrad" cx="50%" cy="50%" r="55%">
                  <stop offset="0%" stopColor={T.color.accent} stopOpacity="0.05" />
                  <stop offset="100%" stopColor={T.color.accent} stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="800" height="540" fill="url(#dgrad)" />
              {(() => {
                const cx = 400, cy = 290;
                const nodes = [
                  { id: 'you', x: cx, y: cy, r: 22, label: 'You', color: T.color.accent, self: true },
                  { id: 'sara',  x: cx - 180, y: cy - 130, r: 17, label: 'Sarah', color: T.color.accent },
                  { id: 'marc',  x: cx + 160, y: cy - 110, r: 16, label: 'Marcus', color: T.color.blue },
                  { id: 'priy',  x: cx + 200, y: cy + 90,  r: 15, label: 'Priya', color: T.color.violet },
                  { id: 'alex',  x: cx - 130, y: cy + 150, r: 14, label: 'Alex', color: T.color.third },
                  { id: 'jord',  x: cx + 80,  y: cy - 200, r: 13, label: 'Jordan', color: T.color.second },
                  { id: 'deep',  x: cx + 280, y: cy + 50,  r: 13, label: 'Deepak', color: T.color.second },
                  { id: 'acme',  x: cx - 260, y: cy + 20,  r: 13, label: 'Acme', color: T.color.blue, sq: true },
                  { id: 'data',  x: cx + 270, y: cy - 30,  r: 13, label: 'Dataweave', color: T.color.blue, sq: true },
                  { id: 'neural', x: cx + 290, y: cy + 180, r: 13, label: 'NeuralPath', color: T.color.violet, sq: true },
                  { id: 'verc',  x: cx + 120, y: cy + 200, r: 11, label: 'Vercel', color: T.color.blue, sq: true },
                  { id: 'oai',   x: cx + 360, y: cy + 110, r: 11, label: 'OpenAI', color: T.color.second, sq: true },
                  { id: 'dev',   x: cx - 30,  y: cy - 220, r: 10, label: 'DevConnect', color: T.color.t40, dm: true },
                  { id: 'aiset', x: cx - 200, y: cy + 230, r: 9,  label: 'AI Summit', color: T.color.t40, dm: true },
                ];
                const nmap = Object.fromEntries(nodes.map(n => [n.id, n]));
                const edges = [
                  ['you','sara'],['you','marc'],['you','priy'],['you','alex'],['you','jord'],['you','deep'],
                  ['sara','acme'],['marc','data'],['priy','neural'],['jord','verc'],['deep','oai'],
                  ['sara','dev'],['marc','dev'],['jord','dev'],['alex','aiset'],['priy','aiset'],
                  ['sara','marc'],['priy','jord'],['priy','deep'],
                ];
                return (
                  <>
                    {edges.map(([a, b], i) => {
                      const A = nmap[a], B = nmap[b];
                      const isPrim = A.id === 'you' || B.id === 'you';
                      return (
                        <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                              stroke={isPrim ? `${T.color.accent}40` : 'rgba(255,255,255,0.1)'}
                              strokeWidth={isPrim ? 1.5 : 1} />
                      );
                    })}
                    {nodes.map(n => (
                      <g key={n.id}>
                        {n.self && (
                          <circle cx={n.x} cy={n.y} r={n.r + 14} fill="none" stroke={n.color} strokeWidth="1" opacity="0.25">
                            <animate attributeName="r" values={`${n.r+14};${n.r+22};${n.r+14}`} dur="3s" repeatCount="indefinite" />
                          </circle>
                        )}
                        {n.id === 'sara' && (
                          <circle cx={n.x} cy={n.y} r={n.r + 6} fill="none" stroke={n.color} strokeWidth="1.5" opacity="0.6" />
                        )}
                        {n.sq ? (
                          <rect x={n.x - n.r} y={n.y - n.r} width={n.r * 2} height={n.r * 2} fill={n.color} opacity={0.85} rx="2" />
                        ) : n.dm ? (
                          <polygon points={`${n.x},${n.y-n.r} ${n.x+n.r},${n.y} ${n.x},${n.y+n.r} ${n.x-n.r},${n.y}`} fill="none" stroke={n.color} strokeWidth="1.5" />
                        ) : (
                          <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} opacity={n.self ? 1 : 0.9} />
                        )}
                        {n.self ? (
                          <text x={n.x} y={n.y + 4} textAnchor="middle" fontFamily={T.font.sans} fontSize="12" fontWeight="800" fill="#000">You</text>
                        ) : (
                          <text x={n.x} y={n.y + n.r + 16} textAnchor="middle" fontFamily={T.font.mono} fontSize="10" fill="rgba(255,255,255,0.55)">{n.label}</text>
                        )}
                      </g>
                    ))}
                  </>
                );
              })()}
            </svg>

            {/* zoom controls bottom-right */}
            <div style={{
              position: 'absolute', bottom: 22, right: 22, zIndex: 10,
              display: 'flex', flexDirection: 'column', gap: 4,
              background: 'rgba(20,20,22,0.85)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 4,
            }}>
              {['plus','search','x'].map((ic, i) => (
                <button key={i} style={{ width: 32, height: 32, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={ic} size={16} color={T.color.t70} />
                </button>
              ))}
            </div>
          </section>

          {/* Detail pane — node selected */}
          <aside style={{ width: 340, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.06)', padding: '24px 22px', overflowY: 'auto' }}>
            <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>◉ selected</div>

            <Avatar name="Sarah" size={64} style={{ marginBottom: 12 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ font: `800 22px ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.02em' }}>Sarah Chen</span>
              <span style={{ padding: '2px 7px', borderRadius: 4, background: `${T.color.accent}1f`, color: T.color.accent, font: `700 9.5px ${T.font.mono}`, letterSpacing: 0.5, textTransform: 'uppercase' }}>warm</span>
            </div>
            <div style={{ font: `400 13px ${T.font.mono}`, color: T.color.t55, marginBottom: 14 }}>Rust Lead · Acme Corp</div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 18 }}>
              <Pill size="sm">#engineering</Pill>
              <Pill size="sm">#rust</Pill>
              <Pill size="sm" color={T.color.accent}>follow-up</Pill>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
              <button style={{ flex: 1, padding: '10px', borderRadius: 10, background: T.color.accent, color: '#000', border: '1.5px solid #000', boxShadow: '3px 3px 0 #000', font: `700 13px ${T.font.sans}`, cursor: 'pointer' }}>Draft check-in →</button>
              <button style={{ padding: '10px 12px', borderRadius: 10, background: 'transparent', color: T.color.t85, border: '1.5px solid rgba(255,255,255,0.18)', font: `600 12px ${T.font.mono}`, cursor: 'pointer', letterSpacing: 0.3 }}>open</button>
            </div>

            {/* Edges */}
            <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t55, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>◆ edges · 5</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 18 }}>
              {[
                { t: 'works_at',  v: 'Acme Corp',     c: T.color.blue, sq: true },
                { t: 'met_at',    v: 'DevConnect 26', c: T.color.t40,  dm: true },
                { t: 'knows',     v: 'Marcus Rivera', c: T.color.blue },
                { t: 'discussed', v: 'edge config',   c: T.color.violet, sq: false, hex: true },
                { t: 'owes',      v: 'edge-reload repo', c: T.color.accent, foll: true },
              ].map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ font: `700 9.5px ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.4, padding: '2px 6px', borderRadius: 4, background: `${T.color.accent}15`, minWidth: 70, textTransform: 'uppercase' }}>{e.t}</span>
                  <span style={{ flex: 1, font: `500 12.5px ${T.font.sans}`, color: T.color.ink }}>{e.v}</span>
                  <Icon name="arrowR" size={12} color={T.color.t40} />
                </div>
              ))}
            </div>

            <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t55, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>◆ last seen</div>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.3 }}>14:32 · oct 14 · DevConnect</div>
              <div style={{ font: `400 12.5px/1.5 ${T.font.sans}`, color: T.color.t85, marginTop: 6 }}>
                "she's their <span style={{ color: T.color.accent, fontWeight: 600 }}>rust lead</span>. Talked edge-config..."
              </div>
            </div>
          </aside>
        </main>
      </DesktopFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // 4. DESKTOP PERSON DETAIL — two-pane
  // ─────────────────────────────────────────────────────────────────────
  function ScreenDesktopPerson() {
    return (
      <DesktopFrame url="wingmic.xyz/p/sarah-chen">
        <Sidebar active="graph" />
        <main style={{ flex: 1, display: 'flex', minWidth: 0 }}>
          {/* List of people */}
          <section style={{ width: 280, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 20px 12px' }}>
              <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>◆ people · 12</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Icon name="search" size={14} color={T.color.t55} />
                <span style={{ flex: 1, font: `400 13px ${T.font.sans}`, color: T.color.t40 }}>filter…</span>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 16px' }}>
              {[
                { name: 'Sarah Chen', sub: 'Acme · Rust Lead',  c: T.color.accent, active: true },
                { name: 'Marcus Rivera', sub: 'Dataweave · CTO', c: T.color.blue },
                { name: 'Priya Sharma',  sub: 'NeuralPath · ML', c: T.color.violet },
                { name: 'Alex Novak',    sub: 'Stripe · Platform', c: T.color.third },
                { name: 'Jordan Kim',    sub: 'Vercel · DX',     c: T.color.second },
                { name: 'Deepak Patel',  sub: 'OpenAI · Research', c: T.color.second },
              ].map(p => (
                <div key={p.name} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                  background: p.active ? 'rgba(255,196,82,0.08)' : 'transparent',
                  border: p.active ? `1px solid ${T.color.accent}40` : '1px solid transparent',
                  marginBottom: 2,
                }}>
                  <Avatar name={p.name} size={32} color={p.c} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: `${p.active ? 700 : 600} 13px ${T.font.sans}`, color: T.color.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ font: `400 10.5px ${T.font.mono}`, color: T.color.t40, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{p.sub}</div>
                  </div>
                  {p.active && <Icon name="arrowR" size={12} color={T.color.accent} />}
                </div>
              ))}
            </div>
          </section>

          {/* Detail */}
          <section style={{ flex: 1, overflowY: 'auto', padding: '28px 36px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, marginBottom: 18 }}>
              <Avatar name="Sarah" size={84} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.accent, letterSpacing: 1.5, textTransform: 'uppercase' }}>◉ person</span>
                  <span style={{ padding: '2px 7px', borderRadius: 4, background: `${T.color.accent}1f`, color: T.color.accent, font: `700 9.5px ${T.font.mono}`, letterSpacing: 0.5, textTransform: 'uppercase' }}>warm · 5 edges</span>
                </div>
                <h1 style={{ margin: 0, font: `900 38px/1 ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.03em' }}>
                  Sarah <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>Chen</i>
                </h1>
                <div style={{ font: `400 14.5px ${T.font.mono}`, color: T.color.t55, marginTop: 6 }}>Rust Lead · Acme Corp · last seen 7d ago</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ padding: '11px 18px', borderRadius: 10, background: T.color.accent, color: '#000', border: '1.5px solid #000', boxShadow: '4px 4px 0 #000', font: `700 14px ${T.font.sans}`, cursor: 'pointer' }}>Draft check-in →</button>
                <button style={{ padding: '11px 14px', borderRadius: 10, background: 'transparent', color: T.color.ink, border: '1.5px solid rgba(255,255,255,0.18)', font: `600 13px ${T.font.sans}`, cursor: 'pointer' }}>Open in graph</button>
                <button style={{ width: 40, height: 40, borderRadius: 10, background: 'transparent', color: T.color.t70, border: '1.5px solid rgba(255,255,255,0.18)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="settings" size={16} />
                </button>
              </div>
            </div>

            {/* Tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
              <Pill>#engineering</Pill>
              <Pill>#rust</Pill>
              <Pill>#hot-reload</Pill>
              <Pill color={T.color.accent}>#follow-up · repo</Pill>
            </div>

            {/* 2-col body */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 22 }}>
              <div>
                {/* From your captures */}
                <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>◆ from your captures · 3</div>
                {[
                  { t: '14:32 · oct 14 · DevConnect 2026', body: '"She\'s their rust lead. Talked edge-config + hot-reloading. I said I\'d send my edge-reload repo."', dur: '0:42' },
                  { t: '09:00 · oct 15 · slack #wingmic',  body: '"@sarah just dropped a link to her HN comment thread on watchman vs notify"', dur: 'text' },
                  { t: '11:14 · oct 17 · DevConnect after-hours', body: '"She and marcus were arguing about whether sqlite\'s WAL is good enough for graph workloads"', dur: '1:08' },
                ].map((c, i) => (
                  <div key={i} style={{
                    padding: 14, marginBottom: 8, borderRadius: 12,
                    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.3 }}>{c.t}</span>
                      <span style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.t30 }}>{c.dur}</span>
                    </div>
                    <div style={{ font: `400 14px/1.55 ${T.font.sans}`, color: T.color.t85 }}>{c.body}</div>
                  </div>
                ))}

                {/* Follow-ups */}
                <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginTop: 22, marginBottom: 10 }}>◆ follow-ups</div>
                <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,196,82,0.06)', border: `1px solid ${T.color.accent}40`, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: T.color.accent, border: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="check" size={12} color="#000" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: `600 13.5px ${T.font.sans}`, color: T.color.ink }}>Send github.com/me/edge-reload</div>
                    <div style={{ font: `400 11px ${T.font.mono}`, color: T.color.t40, marginTop: 2 }}>due · tomorrow · agent drafted</div>
                  </div>
                  <button style={{ padding: '8px 14px', borderRadius: 8, background: T.color.accent, color: '#000', border: '1.5px solid #000', boxShadow: '2px 2px 0 #000', font: `700 12px ${T.font.sans}`, cursor: 'pointer' }}>Open draft</button>
                </div>
              </div>

              <div>
                {/* Stats trio */}
                <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t55, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>◆ at a glance</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  {[
                    { v: '5',  l: 'edges' },
                    { v: '3',  l: 'commits' },
                    { v: '7d', l: 'since' },
                  ].map((s, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <div style={{ font: `400 44px/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent, letterSpacing: '-0.03em' }}>{s.v}</div>
                      <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 6 }}>{s.l}</div>
                    </div>
                  ))}
                </div>

                {/* Related */}
                <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t55, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>◆ related</div>
                {[
                  { n: 'Marcus Rivera', r: 'co-attended DevConnect', c: T.color.blue },
                  { n: 'Acme Corp',     r: 'works at',                c: T.color.blue, sq: true },
                  { n: 'Priya Sharma',  r: 'overlapping · diarization', c: T.color.violet },
                ].map((r, i) => (
                  <div key={i} style={{ padding: 10, marginBottom: 6, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={r.n} size={28} square={r.sq} color={r.c} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: `600 12.5px ${T.font.sans}`, color: T.color.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.n}</div>
                      <div style={{ font: `400 10.5px ${T.font.mono}`, color: T.color.t40, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{r.r}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </DesktopFrame>
    );
  }

  Object.assign(window, {
    DesktopFrame, Sidebar,
    ScreenDesktopHome, ScreenDesktopChat, ScreenDesktopGraph, ScreenDesktopPerson,
  });
})();
