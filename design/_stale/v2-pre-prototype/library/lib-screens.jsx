// library/lib-screens.jsx — mobile-first screens, each in a phone frame
(function () {
  const T = window.WMT;
  const { PhoneFrame, Pill, Avatar, EntityTag, VoiceBars, MicroLabel, Icon, Wordmark } = window;
  const { MicOrb } = window;

  // ── shared screen scaffolding ─────────────────────────────────────────
  function ArtCenter({ children }) {
    // Artboard background + phone centered
    return (
      <div style={{
        position: 'absolute', inset: 0,
        background: '#0a0a0a',
        backgroundImage:
          'radial-gradient(ellipse at 18% 0%, rgba(255,196,82,0.04) 0%, transparent 55%),' +
          'radial-gradient(ellipse at 82% 100%, rgba(255,107,107,0.025) 0%, transparent 55%)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '24px 0 0',
      }}>
        <PhoneFrame>{children}</PhoneFrame>
      </div>
    );
  }

  // ── shared mobile chrome ──────────────────────────────────────────────
  function MobileTopBar({ title, italic, sub, left, right, style }) {
    return (
      <div style={{
        padding: '8px 20px 12px',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12,
        ...style,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {left}
          <div style={{ font: `800 26px/1 ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.02em' }}>
            {title}{italic && <> <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>{italic}</i></>}
          </div>
          {sub && <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40, letterSpacing: 1.2, marginTop: 6, textTransform: 'uppercase' }}>{sub}</div>}
        </div>
        {right}
      </div>
    );
  }
  function MobileNav({ active = 'home' }) {
    const items = [
      { k: 'home',  icon: 'home',  label: 'home' },
      { k: 'chat',  icon: 'chat',  label: 'chat' },
      { k: 'mic',   icon: 'mic',   label: 'capture', big: true },
      { k: 'graph', icon: 'graph', label: 'graph' },
      { k: 'acts',  icon: 'bell',  label: 'acts' },
    ];
    return (
      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 22, zIndex: 80,
        background: 'rgba(10,10,10,0.78)',
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 22, padding: '8px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {items.map(it => {
          const isActive = active === it.k;
          if (it.big) {
            return (
              <div key={it.k} style={{ position: 'relative', top: -16 }}>
                <button style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: T.color.accent, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}><Icon name="mic" size={22} color="#000" /></button>
              </div>
            );
          }
          return (
            <button key={it.k} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '4px 6px',
              color: isActive ? T.color.accent : T.color.t40,
              flex: 1,
            }}>
              <Icon name={it.icon} size={20} color={isActive ? T.color.accent : T.color.t55} />
              <span style={{ font: `600 9px/1 ${T.font.mono}`, letterSpacing: 0.5, textTransform: 'uppercase' }}>{it.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // 1. ONBOARDING
  // ─────────────────────────────────────────────────────────────────────
  function ScreenOnboarding() {
    return (
      <ArtCenter>
        <div style={{ position: 'relative', height: '100%', padding: '40px 24px 36px', display: 'flex', flexDirection: 'column' }}>
          {/* decorative sticker */}
          <div style={{ position: 'absolute', top: 56, right: 16,
            padding: '6px 11px', borderRadius: 999, background: T.color.accent, color: '#000',
            font: `700 10px ${T.font.mono}`, letterSpacing: 1, textTransform: 'uppercase',
            boxShadow: '3px 3px 0 rgba(0,0,0,0.3)', transform: 'rotate(-4deg)',
          }}>v0.1 beta</div>

          <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
            ◆ welcome
          </div>

          {/* big orb visual */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <div style={{
              width: 220, height: 220, borderRadius: '50%',
              background: `radial-gradient(circle, ${T.color.accent}15 0%, transparent 60%)`,
              position: 'absolute',
            }} />
            <div style={{ position: 'relative' }}>
              <MicOrb size={140} state="idle" />
            </div>
            <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} width="100%" height="100%">
              {[0,1,2,3,4,5].map(i => {
                const ang = i * (Math.PI / 3) + 0.4;
                const x = 50 + Math.cos(ang) * 38;
                const y = 50 + Math.sin(ang) * 38;
                const c = [T.color.accent, T.color.second, T.color.third, T.color.blue, T.color.violet, T.color.accent][i];
                return <circle key={i} cx={`${x}%`} cy={`${y}%`} r="4" fill={c} opacity="0.55" />;
              })}
            </svg>
          </div>

          {/* headline */}
          <div style={{ font: `900 44px/0.95 ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.035em', marginTop: 6 }}>
            your social RAM,<br />
            <i style={{ font: `400 1em/0.95 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>on disk.</i>
          </div>
          <p style={{ font: `400 15px/1.5 ${T.font.sans}`, color: T.color.t55, margin: '16px 0 0', maxWidth: 280 }}>
            Hold the mic. Talk like a human. Wingmic builds the graph behind every person you meet.
          </p>

          {/* progress + CTA */}
          <div style={{ marginTop: 28, marginBottom: 24, display: 'flex', gap: 6 }}>
            <div style={{ width: 22, height: 4, borderRadius: 2, background: T.color.accent }} />
            <div style={{ width: 22, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
            <div style={{ width: 22, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
          </div>
          <button style={{
            width: '100%', padding: '15px', borderRadius: 12,
            background: T.color.accent, color: '#000',
            font: `700 15px ${T.font.sans}`, border: '1.5px solid #000', boxShadow: '4px 4px 0 #000',
            cursor: 'pointer',
          }}>Next — give mic access →</button>
          <button style={{
            width: '100%', padding: '12px', marginTop: 10,
            background: 'transparent', color: T.color.t55,
            font: `500 13px ${T.font.mono}`, border: 'none', cursor: 'pointer', letterSpacing: 0.3,
          }}>skip · I'll explore first</button>
        </div>
      </ArtCenter>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // 2. HOME / DASHBOARD
  // ─────────────────────────────────────────────────────────────────────
  function ScreenHome() {
    return (
      <ArtCenter>
        <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
          <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 110 }}>
            <MobileTopBar
              title="today" italic="·"
              sub="mon · oct 21"
              right={
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Icon name="search" size={18} color={T.color.t70} /></button>
                  <Avatar name="M" size={38} />
                </div>
              }
            />

            {/* Stat trio */}
            <div style={{ padding: '10px 20px 0', display: 'flex', gap: 20 }}>
              {[
                { v: '12', l: 'people', c: T.color.accent, r: -2 },
                { v: '3',  l: 'acts',   c: T.color.second, r: 1 },
                { v: '4',  l: 'commits', c: T.color.third,  r: -1 },
              ].map((s, i) => (
                <div key={i} style={{ transform: `rotate(${s.r}deg)` }}>
                  <div style={{ font: `400 56px/0.85 ${T.font.serif}`, fontStyle: 'italic', color: s.c, letterSpacing: '-0.04em' }}>{s.v}</div>
                  <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40, letterSpacing: 1.5, marginTop: 4, textTransform: 'uppercase' }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Agent stripe */}
            <div style={{ margin: '24px 20px 0', padding: '12px 14px', borderRadius: 12,
              background: `linear-gradient(90deg, rgba(255,196,82,0.10), transparent)`,
              border: `1px solid ${T.color.accent}30`,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.color.accent, boxShadow: `0 0 8px ${T.color.accent}`, animation: 'wm-pulse-d 1.6s infinite' }} />
              <div style={{ flex: 1, font: `500 12px ${T.font.mono}`, color: T.color.t85 }}>
                <span style={{ color: T.color.accent, fontWeight: 700 }}>wingmic</span> · read your graph 06:12 · 3 drafts pending
              </div>
              <Icon name="arrowR" size={16} color={T.color.t55} />
            </div>

            {/* Today's acts pinned */}
            <div style={{ padding: '24px 20px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase' }}>◆ acts · pending</div>
                <span style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40 }}>see all →</span>
              </div>

              {[
                { kind: 'check-in', glyph: '↗', name: 'Sarah Chen', why: '7d since DevConnect · you owe her a repo', conf: 92, color: T.color.accent, ch: 'email' },
                { kind: 'reminder', glyph: '◷', name: 'Marcus Rivera', why: 'Coffee Mon · no invite sent', conf: 88, color: T.color.blue, ch: 'cal' },
                { kind: 'intro',    glyph: '⇌', name: 'Priya → Deepak', why: 'Both work on voice + MCP', conf: 74, color: T.color.violet, ch: 'email' },
              ].map((a, i) => (
                <div key={i} style={{
                  padding: 14, borderRadius: 14, marginBottom: 8,
                  background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <Avatar name={a.name} size={36} square color={a.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ font: `700 9.5px ${T.font.mono}`, color: a.color, letterSpacing: 0.6, textTransform: 'uppercase' }}>{a.glyph} {a.kind}</span>
                      <span style={{ font: `500 9.5px ${T.font.mono}`, color: T.color.t40 }}>· {a.conf}%</span>
                    </div>
                    <div style={{ font: `600 14px ${T.font.sans}`, color: T.color.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                    <div style={{ font: `400 12px/1.4 ${T.font.sans}`, color: T.color.t55, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.why}</div>
                  </div>
                  <button style={{ padding: '8px 12px', borderRadius: 8, background: T.color.accent, color: '#000', border: '1.5px solid #000', boxShadow: '2px 2px 0 #000', font: `700 11px ${T.font.sans}`, cursor: 'pointer', whiteSpace: 'nowrap' }}>send →</button>
                </div>
              ))}
            </div>

            {/* Recent commits */}
            <div style={{ padding: '22px 20px 0' }}>
              <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t55, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>◆ recent commits</div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '2px 14px' }}>
                {[
                  { who: 'sarah_chen',   what: 'commit',  d: 'met @ DevConnect · 4 edges', t: '14:32', c: T.color.accent },
                  { who: 'marcus_rivera', what: 'enriched', d: 'sightglass · 9am mon',    t: '15:10', c: T.color.blue },
                  { who: 'priya_sharma',  what: 'commit',  d: 'diarization paper attached', t: '16:45', c: T.color.violet },
                ].map((r, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0',
                    borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.c, animation: 'wm-pulse-d 1.6s infinite' }} />
                    <span style={{ font: `500 10.5px ${T.font.mono}`, color: r.c, minWidth: 78, letterSpacing: 0.3 }}>{r.who}</span>
                    <span style={{ flex: 1, font: `400 12px/1.4 ${T.font.sans}`, color: T.color.t70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.d}</span>
                    <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30 }}>{r.t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div style={{ padding: '24px 20px 0', textAlign: 'center' }}>
              <div style={{ font: `400 14px/1.4 ${T.font.sans}`, color: T.color.t40, fontStyle: 'italic' }}>
                hold the mic. talk like a human.
              </div>
            </div>
          </div>
          <MobileNav active="home" />
        </div>
      </ArtCenter>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // 3. CHAT — RESTING
  // ─────────────────────────────────────────────────────────────────────
  function ChatHeader({ status = 'idle' }) {
    return (
      <div style={{
        padding: '4px 20px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name="W" size={36} square color={T.color.accent} />
          <div>
            <div style={{ font: `700 15px ${T.font.sans}`, color: T.color.ink, letterSpacing: -0.2 }}>wingmic</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: status === 'idle' ? T.color.second : T.color.accent, animation: 'wm-pulse-d 1.6s infinite' }} />
              <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40, letterSpacing: 0.4 }}>
                {status === 'idle' && 'reading 1,247 nodes'}
                {status === 'recording' && '· recording'}
                {status === 'thinking' && 'thinking…'}
                {status === 'responded' && 'just now'}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon name="graph" size={16} color={T.color.t70} />
          </button>
          <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon name="settings" size={16} color={T.color.t70} />
          </button>
        </div>
      </div>
    );
  }

  function ScreenChatResting() {
    return (
      <ArtCenter>
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <ChatHeader status="idle" />
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 140px' }}>
            {/* Day */}
            <div style={{ textAlign: 'center', font: `500 10px ${T.font.mono}`, color: T.color.t30, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 16px' }}>— today · 14:30 —</div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <Avatar name="W" size={28} square color={T.color.accent} />
              <div style={{ maxWidth: 250 }}>
                <div style={{ padding: '11px 14px', borderRadius: '4px 14px 14px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', font: `400 14.5px/1.5 ${T.font.sans}`, color: T.color.t85 }}>
                  Morning. <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>Ask me anything</i> — who you met, what was said, who to thread. Or just hold the mic and tell me about a new contact.
                </div>
                <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30, marginTop: 6, letterSpacing: 0.5 }}>09:00</div>
              </div>
            </div>

            {/* Suggested chips */}
            <div style={{ marginLeft: 38, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>↪ try</div>
              {[
                'who was the rust person at acme?',
                'remind me of last week\'s coffee chats',
                'who should I introduce to priya?',
              ].map((q, i) => (
                <div key={i} style={{
                  alignSelf: 'flex-start',
                  padding: '8px 13px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  font: `400 13px ${T.font.sans}`, color: T.color.t85,
                  cursor: 'pointer',
                }}>{q}</div>
              ))}
            </div>
          </div>

          {/* Composer · resting */}
          <div style={{ position: 'absolute', left: 16, right: 16, bottom: 30, zIndex: 90 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 8px 8px 16px', borderRadius: 999,
              background: 'rgba(20,20,22,0.85)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 14px 30px rgba(0,0,0,0.5)',
            }}>
              <button style={{ width: 32, height: 32, borderRadius: '50%', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="plus" size={16} color={T.color.t70} />
              </button>
              <span style={{ flex: 1, font: `400 14.5px ${T.font.sans}`, color: T.color.t40 }}>ask wingmic…</span>
              <button style={{ width: 44, height: 44, borderRadius: '50%', background: T.color.accent, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="mic" size={18} color="#000" />
              </button>
            </div>
            <div style={{ textAlign: 'center', font: `400 11px ${T.font.mono}`, color: T.color.t30, letterSpacing: 0.5, marginTop: 8, fontStyle: 'italic' }}>
              hold to talk · tap to type
            </div>
          </div>
        </div>
      </ArtCenter>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // 4. CHAT — RECORDING (push to talk)
  // ─────────────────────────────────────────────────────────────────────
  function ScreenChatRecording() {
    return (
      <ArtCenter>
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <ChatHeader status="recording" />

          {/* dimmed thread */}
          <div style={{ flex: 1, overflowY: 'hidden', padding: '20px 20px 280px', opacity: 0.4, pointerEvents: 'none' }}>
            <div style={{ textAlign: 'center', font: `500 10px ${T.font.mono}`, color: T.color.t30, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 16px' }}>— today —</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <Avatar name="W" size={28} square color={T.color.accent} />
              <div style={{ padding: '11px 14px', borderRadius: '4px 14px 14px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', font: `400 14.5px/1.5 ${T.font.sans}`, color: T.color.t85 }}>
                Morning. Ask me anything.
              </div>
            </div>
          </div>

          {/* live transcript card */}
          <div style={{
            position: 'absolute', left: 16, right: 16, bottom: 180, zIndex: 70,
            padding: 16, borderRadius: 16,
            background: 'rgba(255,196,82,0.06)', border: `1px solid ${T.color.accent}50`,
            backdropFilter: 'blur(20px)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.color.alarm, animation: 'wm-pulse-d 1s infinite' }} />
                <span style={{ font: `600 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 1.5, textTransform: 'uppercase' }}>recording</span>
              </div>
              <span style={{ font: `700 16px ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.5 }}>0:12</span>
            </div>
            <div style={{ font: `400 15px/1.55 ${T.font.sans}`, color: T.color.ink, marginBottom: 12 }}>
              met sarah from acme at devconnect, she's their rust lead. need to send her my edge-reload repo<span style={{ display: 'inline-block', width: 2, height: 16, background: T.color.accent, marginLeft: 2, verticalAlign: 'text-bottom', animation: 'wm-blink 0.7s step-end infinite' }} />
            </div>
            <VoiceBars active count={28} height={20} width={2} gap={2} color={T.color.accent} />
          </div>

          {/* hold-to-talk overlay + gestures */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 180, pointerEvents: 'none' }}>
            {/* slide up · lock affordance */}
            <div style={{
              position: 'absolute', bottom: 130, right: 36,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(255,196,82,0.12)', border: `1.5px solid ${T.color.accent}80`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'wm-drift 1.4s ease-in-out infinite',
              }}>
                <Icon name="lock" size={16} color={T.color.accent} />
              </div>
              <span style={{ font: `500 9.5px ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.5, textTransform: 'uppercase' }}>↑ lock</span>
            </div>

            {/* slide-left to cancel hint */}
            <div style={{
              position: 'absolute', bottom: 64, left: 20, right: 96,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Icon name="arrowL" size={16} color={T.color.t55} />
              <span style={{ font: `400 13px ${T.font.sans}`, color: T.color.t55, fontStyle: 'italic' }}>slide to cancel</span>
            </div>

            {/* recording mic */}
            <div style={{ position: 'absolute', bottom: 24, right: 22 }}>
              <MicOrb size={88} state="recording" />
            </div>
          </div>
        </div>
      </ArtCenter>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // 5. CHAT — LOCKED
  // ─────────────────────────────────────────────────────────────────────
  function ScreenChatLocked() {
    return (
      <ArtCenter>
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <ChatHeader status="recording" />

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 280px' }}>
            {/* transcript building */}
            <div style={{
              padding: 16, borderRadius: 16, marginBottom: 12,
              background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40, letterSpacing: 1.5, textTransform: 'uppercase' }}>◆ transcript · live</span>
                <span style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent }}>0:42</span>
              </div>
              <div style={{ font: `400 14.5px/1.55 ${T.font.sans}`, color: T.color.ink }}>
                met sarah from acme at devconnect, she's their rust lead. discussed edge config strategies for hot reloading. she mentioned a paper on speaker diarization that priya sent her. need to thread them<span style={{ display: 'inline-block', width: 2, height: 16, background: T.color.accent, marginLeft: 2, verticalAlign: 'text-bottom', animation: 'wm-blink 0.7s step-end infinite' }} />
              </div>
            </div>

            {/* extracted entities — appearing live */}
            <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.accent, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>↪ extracting…</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              <EntityTag kind="person">sarah chen</EntityTag>
              <EntityTag kind="company">acme corp</EntityTag>
              <EntityTag kind="event">DevConnect</EntityTag>
              <EntityTag kind="concept">edge config</EntityTag>
              <EntityTag kind="person">priya sharma</EntityTag>
              <span style={{
                padding: '3px 9px', borderRadius: 999,
                background: 'rgba(255,255,255,0.04)', color: T.color.t40,
                border: '1px dashed rgba(255,255,255,0.12)',
                font: `600 10.5px ${T.font.mono}`, letterSpacing: 1, textTransform: 'uppercase',
              }}>+ 2 more…</span>
            </div>
          </div>

          {/* Locked bottom bar — bars + duration + discard + send */}
          <div style={{ position: 'absolute', left: 16, right: 16, bottom: 24, zIndex: 90 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: 10, borderRadius: 999,
              background: 'rgba(20,20,22,0.85)', backdropFilter: 'blur(20px)',
              border: `1.5px solid ${T.color.accent}80`,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,196,82,0.18)', border: `1px solid ${T.color.accent}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name="lock" size={14} color={T.color.accent} />
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <VoiceBars active count={18} height={26} color={T.color.accent} />
              </div>
              <span style={{ font: `700 13px ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.4 }}>0:42</span>
              <button style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'rgba(255,107,107,0.12)', border: `1px solid ${T.color.alarm}50`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}><Icon name="trash" size={15} color={T.color.alarm} /></button>
              <button style={{
                width: 44, height: 44, borderRadius: '50%',
                background: T.color.accent, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}><Icon name="arrowUp" size={18} color="#000" /></button>
            </div>
            <div style={{ textAlign: 'center', font: `500 10px ${T.font.mono}`, color: T.color.t40, letterSpacing: 0.5, marginTop: 8, textTransform: 'uppercase' }}>
              hands-free · keep talking
            </div>
          </div>
        </div>
      </ArtCenter>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // 6. CHAT — AGENT RESPONSE
  // ─────────────────────────────────────────────────────────────────────
  function ScreenChatResponse() {
    return (
      <ArtCenter>
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <ChatHeader status="responded" />

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 140px' }}>
            <div style={{ textAlign: 'center', font: `500 10px ${T.font.mono}`, color: T.color.t30, letterSpacing: 1.5, textTransform: 'uppercase', margin: '0 0 16px' }}>— today · 14:30 —</div>

            {/* You */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
              <div style={{ textAlign: 'right', maxWidth: 260 }}>
                <div style={{
                  display: 'inline-block', textAlign: 'left',
                  padding: '11px 14px', borderRadius: '18px 18px 4px 18px',
                  background: T.color.accent, color: '#000',
                  font: `500 14.5px/1.45 ${T.font.sans}`,
                  border: '1.5px solid #000', boxShadow: '3px 3px 0 #000',
                }}>who was the rust person at acme?</div>
                <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30, marginTop: 6, letterSpacing: 0.5 }}>14:32</div>
              </div>
            </div>

            {/* Agent */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <Avatar name="W" size={28} square color={T.color.accent} />
              <div style={{ flex: 1, maxWidth: 280 }}>
                <div style={{
                  padding: '12px 14px', borderRadius: '4px 14px 14px 14px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: T.color.t85, font: `400 14.5px/1.55 ${T.font.sans}`,
                }}>
                  <span style={{ color: T.color.accent, fontWeight: 600 }}>Sarah Chen</span> — Rust Lead at <span style={{ color: T.color.blue }}>Acme</span>. You met at <span style={{ color: T.color.t40 }}>DevConnect</span> on Oct 14. She talked edge-config + hot-reloading and you said you'd send your <span style={{ fontFamily: T.font.mono, color: T.color.accent }}>edge-reload</span> repo.
                </div>
                <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30, marginTop: 6, letterSpacing: 0.5 }}>
                  ↪ sourced from: voice note 14:32 · 3 commits
                </div>
              </div>
            </div>

            {/* Person card embedded */}
            <div style={{
              marginLeft: 38, marginBottom: 12,
              padding: 14, borderRadius: 14,
              background: 'rgba(255,255,255,0.025)', border: `1px solid ${T.color.accent}30`,
              boxShadow: `0 0 40px rgba(255,196,82,0.1)`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name="Sarah" size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: `700 15px ${T.font.sans}`, color: T.color.ink }}>Sarah Chen</div>
                  <div style={{ font: `400 12px ${T.font.mono}`, color: T.color.t55, marginTop: 2 }}>Rust Lead · Acme Corp</div>
                </div>
                <button style={{ width: 32, height: 32, borderRadius: '50%', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Icon name="arrowR" size={14} color={T.color.t70} />
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 12 }}>
                <Pill size="sm">#engineering</Pill>
                <Pill size="sm">#rust</Pill>
                <Pill size="sm" color={T.color.accent}>follow-up · repo</Pill>
              </div>
            </div>

            {/* Suggested action */}
            <div style={{ marginLeft: 38, display: 'flex', gap: 6 }}>
              <button style={{
                padding: '9px 14px', borderRadius: 999,
                background: T.color.accent, color: '#000',
                font: `700 12px ${T.font.sans}`, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000',
                cursor: 'pointer',
              }}>Draft follow-up →</button>
              <button style={{
                padding: '9px 12px', borderRadius: 999,
                background: 'transparent', color: T.color.t70,
                font: `500 12px ${T.font.mono}`, border: '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer', letterSpacing: 0.3,
              }}>open card</button>
            </div>
          </div>

          {/* Composer — resting */}
          <div style={{ position: 'absolute', left: 16, right: 16, bottom: 30, zIndex: 90 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 8px 8px 16px', borderRadius: 999,
              background: 'rgba(20,20,22,0.85)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 14px 30px rgba(0,0,0,0.5)',
            }}>
              <button style={{ width: 32, height: 32, borderRadius: '50%', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="plus" size={16} color={T.color.t70} />
              </button>
              <span style={{ flex: 1, font: `400 14.5px ${T.font.sans}`, color: T.color.t40 }}>ask wingmic…</span>
              <button style={{ width: 44, height: 44, borderRadius: '50%', background: T.color.accent, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="mic" size={18} color="#000" />
              </button>
            </div>
          </div>
        </div>
      </ArtCenter>
    );
  }

  Object.assign(window, {
    ArtCenter, MobileNav, ChatHeader,
    ScreenOnboarding, ScreenHome,
    ScreenChatResting, ScreenChatRecording, ScreenChatLocked, ScreenChatResponse,
  });
})();
