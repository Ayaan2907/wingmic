// proto-screens-a.jsx — Onboarding, Home, Chat (Resting / Recording / Locked)
(function () {
  const T = window.PT;
  const { Icon, Avatar, Pill, EntityTag, VoiceBars, MicOrb, ActivityRow } = window;
  const { PhoneFrame, MobileNav, ChatHeader, MobileTopBar, Eyebrow } = window;

  // ── ONBOARDING ───────────────────────────────────────────────────────────
  function ScreenOnboarding({ onNavigate }) {
    return (
      <PhoneFrame>
        <div style={{ position: 'relative', height: '100%', padding: '40px 24px 36px', display: 'flex', flexDirection: 'column', color: T.color.ink, fontFamily: T.font.sans }}>
          <div style={{ position: 'absolute', top: 56, right: 16 }}>
            <span style={{ padding: '5px 10px', borderRadius: 999, background: T.color.accent, color: '#000', font: `700 10px ${T.font.mono}`, letterSpacing: 1, textTransform: 'uppercase', boxShadow: '3px 3px 0 rgba(0,0,0,0.3)', transform: 'rotate(-4deg)', display: 'inline-block' }}>v0.1 beta</span>
          </div>
          <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>◆ welcome</div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <div style={{ width: 240, height: 240, borderRadius: '50%', background: `radial-gradient(circle, ${T.color.accent}15 0%, transparent 60%)`, position: 'absolute' }} />
            <MicOrb size={140} state="idle" />
            <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
              {[0,1,2,3,4,5].map(i => {
                const ang = i * (Math.PI / 3) + 0.4;
                const x = 50 + Math.cos(ang) * 38;
                const y = 50 + Math.sin(ang) * 38;
                const c = [T.color.accent, T.color.second, T.color.third, T.color.blue, T.color.violet, T.color.accent][i];
                return <circle key={i} cx={x} cy={y} r="3" fill={c} opacity="0.6" />;
              })}
            </svg>
          </div>
          <div style={{ font: `900 44px/0.95 ${T.font.sans}`, letterSpacing: '-0.035em' }}>
            your social RAM,<br />
            <i style={{ font: `400 1em/0.95 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>on disk.</i>
          </div>
          <p style={{ font: `400 15px/1.5 ${T.font.sans}`, color: T.color.t55, margin: '16px 0 0' }}>
            Hold the mic. Talk like a human. Wingmic builds the graph behind every person you meet.
          </p>
          <div style={{ marginTop: 28, marginBottom: 20, display: 'flex', gap: 6 }}>
            <div style={{ width: 22, height: 4, borderRadius: 2, background: T.color.accent }} />
            <div style={{ width: 22, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
            <div style={{ width: 22, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
          </div>
          <button onClick={() => onNavigate('home')} style={{ width: '100%', padding: '15px', borderRadius: 12, background: T.color.accent, color: '#000', font: `700 15px ${T.font.sans}`, border: '1.5px solid #000', boxShadow: '4px 4px 0 #000', cursor: 'pointer' }}>
            Next — give mic access →
          </button>
          <button onClick={() => onNavigate('home')} style={{ width: '100%', padding: '12px', marginTop: 10, background: 'transparent', color: T.color.t55, font: `500 13px ${T.font.mono}`, border: 'none', cursor: 'pointer' }}>
            skip · I'll explore first
          </button>
        </div>
      </PhoneFrame>
    );
  }

  // ── HOME / DASHBOARD ─────────────────────────────────────────────────────
  function ScreenHome({ onNavigate }) {
    return (
      <PhoneFrame>
        <div style={{ position: 'relative', height: '100%', overflow: 'hidden', color: T.color.ink, fontFamily: T.font.sans }}>
          <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 110 }}>
            <MobileTopBar title="today" italic="·" sub="mon · oct 21"
              right={
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => onNavigate('search')} style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Icon name="search" size={18} color={T.color.t70} />
                  </button>
                  <Avatar name="M" size={38} color={T.color.third} />
                </div>
              }
            />
            {/* Stat trio */}
            <div style={{ padding: '10px 24px 0', display: 'flex', gap: 24 }}>
              {[{ v:'12', l:'people', c:T.color.accent, r:-2 }, { v:'3', l:'acts', c:T.color.second, r:1 }, { v:'4', l:'commits', c:T.color.third, r:-1 }].map((s,i) => (
                <div key={i} style={{ transform: `rotate(${s.r}deg)` }}>
                  <div style={{ font: `400 56px/0.85 ${T.font.serif}`, fontStyle: 'italic', color: s.c, letterSpacing: '-0.04em' }}>{s.v}</div>
                  <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40, letterSpacing: 1.5, marginTop: 4, textTransform: 'uppercase' }}>{s.l}</div>
                </div>
              ))}
            </div>
            {/* Agent stripe */}
            <div style={{ margin: '20px 20px 0', padding: '12px 14px', borderRadius: 12, background: 'linear-gradient(90deg, rgba(255,196,82,0.10), transparent)', border: `1px solid ${T.color.accent}30`, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => onNavigate('acts')}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.color.accent, animation: 'wm-pulse-d 1.6s infinite', flexShrink: 0 }} />
              <div style={{ flex: 1, font: `500 12px ${T.font.mono}`, color: T.color.t85 }}>
                <span style={{ color: T.color.accent, fontWeight: 700 }}>wingmic</span> · read your graph 06:12 · 3 drafts pending
              </div>
              <Icon name="arrowR" size={16} color={T.color.t55} />
            </div>
            {/* Acts pending */}
            <div style={{ padding: '20px 20px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <Eyebrow>acts · pending</Eyebrow>
                <button onClick={() => onNavigate('acts')} style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40, background: 'none', border: 'none', cursor: 'pointer' }}>see all →</button>
              </div>
              {[
                { kind:'check-in', glyph:'↗', name:'Sarah Chen', why:'7d since DevConnect · you owe her a repo', conf:92, color:T.color.accent },
                { kind:'reminder', glyph:'◷', name:'Marcus Rivera', why:'Coffee Mon · no invite sent', conf:88, color:T.color.blue },
                { kind:'intro',   glyph:'⇌', name:'Priya → Deepak', why:'Both work on voice + MCP', conf:74, color:T.color.violet },
              ].map((a, i) => (
                <div key={i} onClick={() => onNavigate('acts')} style={{ padding: 14, borderRadius: 14, marginBottom: 8, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <Avatar name={a.name} size={36} square color={a.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ font: `700 9.5px ${T.font.mono}`, color: a.color, letterSpacing: 0.6, textTransform: 'uppercase' }}>{a.glyph} {a.kind}</span>
                      <span style={{ font: `500 9.5px ${T.font.mono}`, color: T.color.t40 }}>· {a.conf}%</span>
                    </div>
                    <div style={{ font: `600 14px ${T.font.sans}`, color: T.color.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                    <div style={{ font: `400 12px/1.3 ${T.font.sans}`, color: T.color.t55, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.why}</div>
                  </div>
                  <button style={{ padding: '7px 11px', borderRadius: 8, background: T.color.accent, color: '#000', border: '1.5px solid #000', boxShadow: '2px 2px 0 #000', font: `700 11px ${T.font.sans}`, cursor: 'pointer', flexShrink: 0 }}>send →</button>
                </div>
              ))}
            </div>
            {/* Recent commits */}
            <div style={{ padding: '18px 20px 0' }}>
              <Eyebrow>recent commits</Eyebrow>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '2px 14px' }}>
                <ActivityRow who="sarah_chen" what="commit" detail="met @ DevConnect · 4 edges" time="14:32" color={T.color.accent} />
                <ActivityRow who="marcus_r" what="enriched" detail="sightglass coffee · 9am mon" time="15:10" color={T.color.blue} />
                <ActivityRow who="priya_s" what="commit" detail="diarization paper attached" time="16:45" color={T.color.violet} last />
              </div>
            </div>
            <div style={{ padding: '20px 20px 8px', textAlign: 'center', font: `400 13px ${T.font.sans}`, color: T.color.t30, fontStyle: 'italic' }}>hold the mic. talk like a human.</div>
          </div>
          <MobileNav active="home" onNavigate={onNavigate} />
        </div>
      </PhoneFrame>
    );
  }

  // ── CHAT RESTING ─────────────────────────────────────────────────────────
  function ScreenChatResting({ onNavigate }) {
    return (
      <PhoneFrame>
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', color: T.color.ink, fontFamily: T.font.sans }}>
          <ChatHeader status="idle" onNavigate={onNavigate} />
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 130px' }}>
            <div style={{ textAlign: 'center', font: `500 10px ${T.font.mono}`, color: T.color.t30, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>— today · 14:30 —</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <Avatar name="W" size={28} square color={T.color.accent} />
              <div style={{ maxWidth: 250 }}>
                <div style={{ padding: '11px 14px', borderRadius: '4px 14px 14px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', font: `400 14.5px/1.5 ${T.font.sans}`, color: T.color.t85 }}>
                  Morning. <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>Ask me anything</i> — who you met, what was said, who to thread. Or just hold the mic.
                </div>
                <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30, marginTop: 6, letterSpacing: 0.5 }}>09:00</div>
              </div>
            </div>
            <div style={{ marginLeft: 38, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>↪ try</div>
              {['who was the rust person at acme?', 'remind me of last week\'s coffee chats', 'who should I introduce to priya?'].map((q, i) => (
                <div key={i} onClick={() => onNavigate('chat-response')} style={{ alignSelf: 'flex-start', padding: '8px 13px', borderRadius: 999, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', font: `400 13px ${T.font.sans}`, color: T.color.t85, cursor: 'pointer' }}>{q}</div>
              ))}
            </div>
          </div>
          <div style={{ position: 'absolute', left: 16, right: 16, bottom: 28, zIndex: 90 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 16px', borderRadius: 999, background: 'rgba(20,20,22,0.9)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 14px 30px rgba(0,0,0,0.5)' }}>
              <button style={{ width: 32, height: 32, borderRadius: '50%', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="plus" size={16} color={T.color.t70} />
              </button>
              <span style={{ flex: 1, font: `400 14.5px ${T.font.sans}`, color: T.color.t40 }}>ask wingmic…</span>
              <button onClick={() => onNavigate('chat-recording')} style={{ width: 44, height: 44, borderRadius: '50%', background: T.color.accent, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="mic" size={18} color="#000" />
              </button>
            </div>
            <div style={{ textAlign: 'center', font: `400 11px ${T.font.mono}`, color: T.color.t30, letterSpacing: 0.5, marginTop: 8, fontStyle: 'italic' }}>hold to talk · tap to type</div>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  // ── CHAT RECORDING ───────────────────────────────────────────────────────
  function ScreenChatRecording({ onNavigate }) {
    return (
      <PhoneFrame>
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', color: T.color.ink, fontFamily: T.font.sans }}>
          <ChatHeader status="recording" onNavigate={onNavigate} />
          <div style={{ flex: 1, padding: '20px 20px 300px', opacity: 0.4, pointerEvents: 'none' }}>
            <div style={{ textAlign: 'center', font: `500 10px ${T.font.mono}`, color: T.color.t30, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>— today —</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Avatar name="W" size={28} square color={T.color.accent} />
              <div style={{ padding: '11px 14px', borderRadius: '4px 14px 14px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', font: `400 14.5px/1.5 ${T.font.sans}`, color: T.color.t85 }}>Morning. Ask me anything.</div>
            </div>
          </div>
          {/* Live transcript */}
          <div style={{ position: 'absolute', left: 16, right: 16, bottom: 185, zIndex: 70, padding: 16, borderRadius: 16, background: 'rgba(255,196,82,0.06)', border: `1px solid ${T.color.accent}50`, backdropFilter: 'blur(20px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.color.alarm, animation: 'wm-pulse-d 1s infinite' }} />
                <span style={{ font: `600 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 1.5, textTransform: 'uppercase' }}>recording</span>
              </div>
              <span style={{ font: `700 16px ${T.font.mono}`, color: T.color.accent }}>0:12</span>
            </div>
            <div style={{ font: `400 15px/1.55 ${T.font.sans}`, color: T.color.ink, marginBottom: 12 }}>
              met sarah from acme at devconnect, she's their rust lead. need to send her my edge-reload repo<span style={{ display: 'inline-block', width: 2, height: 16, background: T.color.accent, marginLeft: 2, verticalAlign: 'text-bottom', animation: 'wm-blink 0.7s step-end infinite' }} />
            </div>
            <VoiceBars active count={28} height={20} width={2} gap={2} />
          </div>
          {/* Gesture layer */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 185, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', bottom: 110, right: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,196,82,0.12)', border: `1.5px solid ${T.color.accent}80`, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'wm-drift 1.4s ease-in-out infinite' }}>
                <Icon name="lock" size={16} color={T.color.accent} />
              </div>
              <span style={{ font: `500 9px ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.5, textTransform: 'uppercase' }}>↑ lock</span>
            </div>
            <div style={{ position: 'absolute', bottom: 64, left: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="arrowL" size={14} color={T.color.t55} />
              <span style={{ font: `400 13px ${T.font.sans}`, color: T.color.t55, fontStyle: 'italic' }}>slide to cancel</span>
            </div>
          </div>
          {/* Orb + tap targets */}
          <div style={{ position: 'absolute', bottom: 24, right: 22, pointerEvents: 'auto' }}>
            <div onClick={() => onNavigate('chat-locked')} style={{ cursor: 'pointer' }}>
              <MicOrb size={88} state="recording" />
            </div>
          </div>
          <button onClick={() => onNavigate('chat-response')} style={{ position: 'absolute', bottom: 28, left: 20, background: 'none', border: 'none', cursor: 'pointer', font: `500 11px ${T.font.mono}`, color: T.color.t40, letterSpacing: 0.5 }}>release →</button>
        </div>
      </PhoneFrame>
    );
  }

  // ── CHAT LOCKED ──────────────────────────────────────────────────────────
  function ScreenChatLocked({ onNavigate }) {
    return (
      <PhoneFrame>
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', color: T.color.ink, fontFamily: T.font.sans }}>
          <ChatHeader status="recording" onNavigate={onNavigate} />
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 130px' }}>
            <div style={{ padding: 16, borderRadius: 16, marginBottom: 12, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40, letterSpacing: 1.5, textTransform: 'uppercase' }}>◆ transcript · live</span>
                <span style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent }}>0:42</span>
              </div>
              <div style={{ font: `400 14.5px/1.55 ${T.font.sans}`, color: T.color.ink }}>
                met sarah from acme at devconnect, she's their rust lead. discussed edge config strategies for hot reloading. she mentioned a paper on speaker diarization that priya sent her. need to thread them<span style={{ display: 'inline-block', width: 2, height: 16, background: T.color.accent, marginLeft: 2, verticalAlign: 'text-bottom', animation: 'wm-blink 0.7s step-end infinite' }} />
              </div>
            </div>
            <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.accent, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>↪ extracting…</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <EntityTag kind="person">sarah chen</EntityTag>
              <EntityTag kind="company">acme corp</EntityTag>
              <EntityTag kind="event">DevConnect</EntityTag>
              <EntityTag kind="concept">edge config</EntityTag>
              <EntityTag kind="person">priya sharma</EntityTag>
              <span style={{ padding: '3px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', color: T.color.t40, border: '1px dashed rgba(255,255,255,0.12)', font: `600 10.5px ${T.font.mono}`, letterSpacing: 1, textTransform: 'uppercase' }}>+ 2 more…</span>
            </div>
          </div>
          {/* Locked bar */}
          <div style={{ position: 'absolute', left: 16, right: 16, bottom: 22, zIndex: 90 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 999, background: 'rgba(20,20,22,0.9)', backdropFilter: 'blur(20px)', border: `1.5px solid ${T.color.accent}80` }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,196,82,0.18)', border: `1px solid ${T.color.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="lock" size={14} color={T.color.accent} />
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <VoiceBars active count={18} height={26} />
              </div>
              <span style={{ font: `700 13px ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.4 }}>0:42</span>
              <button style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,107,107,0.12)', border: `1px solid ${T.color.alarm}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="trash" size={15} color={T.color.alarm} />
              </button>
              <button onClick={() => onNavigate('chat-response')} style={{ width: 44, height: 44, borderRadius: '50%', background: T.color.accent, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="arrowUp" size={18} color="#000" />
              </button>
            </div>
            <div style={{ textAlign: 'center', font: `500 10px ${T.font.mono}`, color: T.color.t40, letterSpacing: 0.5, marginTop: 8, textTransform: 'uppercase' }}>hands-free · keep talking</div>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  Object.assign(window, { ScreenOnboarding, ScreenHome, ScreenChatResting, ScreenChatRecording, ScreenChatLocked });
})();
