// library/lib-voice.jsx — mic states, voice bars, chat thread, chat composer
(function () {
  const T = window.WMT;
  const { ArtboardFrame, ABTitle, MicroLabel, VoiceBars, Pill, Avatar, EntityTag, Icon } = window;

  // ─────────────────────────────────────────────────────────────────────
  // MIC BUTTON — every state
  // ─────────────────────────────────────────────────────────────────────
  // Orb sizes: 64 sm, 88 md, 110 lg, 140 xl
  function MicOrb({ size = 110, color = T.color.accent, state = 'idle', icon = 'mic', halo = true, rings = true }) {
    // state: idle | hover | recording | locked | sending | thinking | done
    const isActive = state === 'recording' || state === 'locked';
    const iconColor = state === 'idle' || state === 'hover' || state === 'sending' ? T.color.t70 : '#000';
    const orbBg     = isActive || state === 'sending' || state === 'done' ? color : 'rgba(255,255,255,0.06)';
    const orbBorder = isActive ? color : (state === 'hover' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)');

    return (
      <div style={{ position: 'relative', width: size + 60, height: size + 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {halo && state !== 'idle' && (
          <div style={{
            position: 'absolute', width: size + 60, height: size + 60, borderRadius: '50%',
            background: `radial-gradient(circle, ${color}25 0%, transparent 65%)`,
            pointerEvents: 'none',
          }} />
        )}
        {rings && isActive && [0, 1, 2].map(i => (
          <div key={i} style={{
            position: 'absolute',
            width: size + i * 20, height: size + i * 20,
            borderRadius: '50%', border: `1.5px solid ${color}`,
            opacity: Math.max(0, 0.55 - i * 0.18),
            animation: `wm-pulse-s ${1.4 + i * 0.3}s ease-in-out infinite`,
          }} />
        ))}
        <div style={{
          width: size, height: size, borderRadius: '50%',
          background: orbBg, border: `2px solid ${orbBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isActive ? `0 0 60px ${color}50` : 'none',
          transition: 'all 0.25s ease-out',
          position: 'relative', zIndex: 2,
        }}>
          {state === 'thinking' ? (
            <div style={{ display: 'flex', gap: 6 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 9, height: 9, borderRadius: '50%', background: '#000',
                  animation: `wm-pulse-d 1.4s ease-in-out ${i * 0.18}s infinite`,
                }} />
              ))}
            </div>
          ) : (
            <Icon name={icon} size={size * 0.35} color={iconColor} />
          )}
        </div>
      </div>
    );
  }

  function VoiceMicStates() {
    const states = [
      { s: 'idle',      l: 'idle',          n: 'resting · invitation', icon: 'mic' },
      { s: 'hover',     l: 'hover',         n: 'cursor / press-in',    icon: 'mic' },
      { s: 'recording', l: 'recording',     n: 'live · pulse-s + rings', icon: 'mic' },
      { s: 'locked',    l: 'locked',        n: 'hands-free · lock glyph', icon: 'lock' },
      { s: 'thinking',  l: 'agent thinking',n: 'after release · 3-dot' },
      { s: 'sending',   l: 'sending',       n: 'arrow-up · spinner halo', icon: 'arrowUp' },
      { s: 'done',      l: 'done',          n: 'check · 600ms then fade', icon: 'check' },
    ];
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="03.1 / mic button" title="Seven states. " italic="One vocabulary." lead="The centerpiece. Every transition is a system cue from §01.6 — pulse-s, ring, blink, rise." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginTop: 8 }}>
          {states.map(st => (
            <div key={st.s} style={{
              padding: 14, borderRadius: 14,
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              <MicOrb size={86} state={st.s} icon={st.icon} />
              <div style={{ font: `700 11px/1 ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.5, marginTop: 8 }}>{st.l}</div>
              <div style={{ font: `400 11.5px/1.4 ${T.font.sans}`, color: T.color.t55, textAlign: 'center' }}>{st.n}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 24 }}>
          <div style={{
            padding: 16, borderRadius: 14,
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <MicroLabel style={{ marginBottom: 10 }}>size · sm (56)</MicroLabel>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 110 }}>
              <MicOrb size={56} state="idle" />
            </div>
            <div style={{ font: `400 12px/1.45 ${T.font.sans}`, color: T.color.t55, marginTop: 4 }}>for composer · inline send</div>
          </div>
          <div style={{
            padding: 16, borderRadius: 14,
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <MicroLabel style={{ marginBottom: 10 }}>size · md (88)</MicroLabel>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140 }}>
              <MicOrb size={88} state="recording" />
            </div>
            <div style={{ font: `400 12px/1.45 ${T.font.sans}`, color: T.color.t55, marginTop: 4 }}>for sheets · capture moments</div>
          </div>
          <div style={{
            padding: 16, borderRadius: 14,
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <MicroLabel style={{ marginBottom: 10 }}>size · lg (140)</MicroLabel>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 170 }}>
              <MicOrb size={140} state="locked" icon="lock" />
            </div>
            <div style={{ font: `400 12px/1.45 ${T.font.sans}`, color: T.color.t55, marginTop: 4 }}>full-screen capture · hero</div>
          </div>
        </div>
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // VOICE BARS — variants
  // ─────────────────────────────────────────────────────────────────────
  function VoiceBarsCard() {
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="03.2 / voice bars" title="Musical, " italic="not random." lead="Phase-driven heights. Idle = 20% white at 4px. Active = amber, 4–38px. 22 bars, 3px wide, 3px gap." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
          <div style={{ padding: 22, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }}>
            <MicroLabel style={{ marginBottom: 14 }}>idle</MicroLabel>
            <VoiceBars active={false} count={22} height={38} />
            <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40, marginTop: 16, letterSpacing: 0.4 }}>height: 4px · color: rgba(_,_,_,.2)</div>
          </div>
          <div style={{ padding: 22, background: 'rgba(255,196,82,0.05)', border: `1px solid ${T.color.accent}40`, borderRadius: 14 }}>
            <MicroLabel style={{ marginBottom: 14, color: T.color.accent }}>active · recording</MicroLabel>
            <VoiceBars active count={22} height={38} color={T.color.accent} />
            <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40, marginTop: 16, letterSpacing: 0.4 }}>height: 4–38px · color: --accent</div>
          </div>
          <div style={{ padding: 22, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }}>
            <MicroLabel style={{ marginBottom: 14 }}>compact · inline</MicroLabel>
            <VoiceBars active count={14} height={20} width={2} gap={2} color={T.color.accent} />
            <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40, marginTop: 16, letterSpacing: 0.4 }}>composer · in-line w/ duration</div>
          </div>
          <div style={{ padding: 22, background: '#08080d', border: '1px solid rgba(255,107,107,0.4)', borderRadius: 14 }}>
            <MicroLabel style={{ marginBottom: 14, color: T.color.alarm }}>discarding · cancel</MicroLabel>
            <VoiceBars active count={22} height={38} color={T.color.alarm} />
            <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40, marginTop: 16, letterSpacing: 0.4 }}>swap to --alarm before fade</div>
          </div>
        </div>
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // CHAT THREAD — message parts
  // ─────────────────────────────────────────────────────────────────────
  function MsgYou({ children, time, voice = false, duration }) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <div style={{ maxWidth: 320, textAlign: 'right' }}>
          {voice ? (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', borderRadius: '18px 18px 4px 18px',
              background: T.color.accent, color: '#000',
              border: '1.5px solid #000', boxShadow: '3px 3px 0 #000',
            }}>
              <button style={{
                width: 28, height: 28, borderRadius: '50%', border: '1.5px solid #000',
                background: '#000', color: T.color.accent,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>▶</button>
              <VoiceBars active count={14} height={20} width={2} gap={2} color="#000" />
              <span style={{ font: `600 11px ${T.font.mono}`, letterSpacing: 0.4 }}>{duration}</span>
            </div>
          ) : (
            <div style={{
              display: 'inline-block', textAlign: 'left',
              padding: '11px 15px', borderRadius: '18px 18px 4px 18px',
              background: T.color.accent, color: '#000',
              font: `500 14.5px/1.45 ${T.font.sans}`, letterSpacing: -0.1,
              border: '1.5px solid #000', boxShadow: '3px 3px 0 #000',
              maxWidth: 320,
            }}>{children}</div>
          )}
          <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30, marginTop: 6, letterSpacing: 0.5 }}>{time}</div>
        </div>
      </div>
    );
  }
  function MsgAgent({ children, time, sources, status }) {
    return (
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <Avatar name="W" size={32} square color={T.color.accent} style={{ marginTop: 2 }} />
        <div style={{ flex: 1, maxWidth: 360 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ font: `700 12px ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.4 }}>wingmic</span>
            <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30, letterSpacing: 0.4 }}>{time}</span>
          </div>
          <div style={{
            padding: '12px 14px', borderRadius: '4px 14px 14px 14px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: T.color.t85, font: `400 14.5px/1.55 ${T.font.sans}`,
          }}>{children}
            {status === 'streaming' && (
              <span style={{ display: 'inline-block', width: 2, height: 16, background: T.color.accent, marginLeft: 3, verticalAlign: 'text-bottom', animation: 'wm-blink 0.7s step-end infinite' }} />
            )}
          </div>
          {sources && sources.length > 0 && (
            <div style={{ font: `500 10.5px/1.5 ${T.font.mono}`, color: T.color.t30, marginTop: 8, letterSpacing: 0.3 }}>
              ↪ sourced from: {sources.join(' · ')}
            </div>
          )}
        </div>
      </div>
    );
  }

  function ChatThreadComponent() {
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="03.3 / chat thread" title="Two voices. " italic="One transcript." lead="You = amber brutalist bubble. Agent = translucent w/ wingmic monogram. Sources always cited." />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
          <div>
            <MicroLabel style={{ marginBottom: 14 }}>you · text + voice</MicroLabel>
            <MsgYou time="14:32">who was that rust person at acme?</MsgYou>
            <MsgYou time="14:33" voice duration="0:08" />
            <MicroLabel style={{ marginTop: 18, marginBottom: 14 }}>agent · response + streaming</MicroLabel>
            <MsgAgent time="14:32" sources={['voice note 14:32', 'commit: sarah / acme']}>
              That's <span style={{ color: T.color.accent, fontWeight: 600 }}>Sarah Chen</span> — Rust Lead at Acme. You met her at DevConnect last week and promised to send your edge-reload repo.
            </MsgAgent>
            <MsgAgent time="14:32" status="streaming">She also mentioned</MsgAgent>
          </div>

          <div>
            <MicroLabel style={{ marginBottom: 14 }}>agent · with chip rail</MicroLabel>
            <MsgAgent time="14:34" sources={['commit log · last 30d']}>
              Three people you met talked about edge config. Want me to thread them?
            </MsgAgent>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginLeft: 42, marginTop: -6, marginBottom: 16 }}>
              <EntityTag kind="person">Sarah Chen</EntityTag>
              <EntityTag kind="person">Marcus Rivera</EntityTag>
              <EntityTag kind="person">Jordan Kim</EntityTag>
            </div>

            <MicroLabel style={{ marginBottom: 14 }}>agent · suggested actions</MicroLabel>
            <MsgAgent time="14:35">
              I can draft an intro between Sarah and Marcus — both work on hot-reloading. Send?
            </MsgAgent>
            <div style={{ display: 'flex', gap: 8, marginLeft: 42 }}>
              <button style={{
                padding: '10px 16px', borderRadius: 999,
                background: T.color.accent, color: '#000',
                font: `700 12.5px ${T.font.sans}`, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000',
                cursor: 'pointer',
              }}>Draft intro →</button>
              <button style={{
                padding: '10px 14px', borderRadius: 999,
                background: 'transparent', color: T.color.t70,
                font: `500 12px ${T.font.mono}`, border: '1px solid rgba(255,255,255,0.15)',
                cursor: 'pointer', letterSpacing: 0.3,
              }}>skip</button>
            </div>

            <div style={{ marginTop: 22, padding: 14, background: 'rgba(255,196,82,0.06)', border: `1px solid ${T.color.accent}30`, borderRadius: 10 }}>
              <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>◆ system · day separator</div>
              <div style={{ font: `500 12px ${T.font.mono}`, color: T.color.t55, letterSpacing: 0.4 }}>— today · monday · oct 21 —</div>
            </div>
          </div>
        </div>
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // CHAT COMPOSER — voice-first
  // ─────────────────────────────────────────────────────────────────────
  function ChatComposerComponent() {
    return (
      <ArtboardFrame padding={36} scrollY>
        <ABTitle eyebrow="03.4 / composer" title="Press, hold, " italic="release." lead="Voice is the default. Hold the mic to record. Slide up to lock hands-free. Slide left to discard." />

        {/* Resting */}
        <MicroLabel style={{ marginBottom: 10 }}>resting</MicroLabel>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22,
          padding: 10, borderRadius: 999,
          background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <button style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}><Icon name="plus" size={18} color={T.color.t70} /></button>
          <input
            readOnly defaultValue=""
            placeholder="ask wingmic…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              padding: '0 8px', color: T.color.ink, font: `400 14.5px ${T.font.sans}`,
            }} />
          <button style={{
            width: 48, height: 48, borderRadius: '50%',
            background: T.color.accent, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}><Icon name="mic" size={20} color="#000" /></button>
        </div>

        {/* Typing */}
        <MicroLabel style={{ marginBottom: 10 }}>typing · send replaces mic</MicroLabel>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22,
          padding: 10, borderRadius: 999,
          background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${T.color.accent}50`,
        }}>
          <button style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}><Icon name="plus" size={18} color={T.color.t70} /></button>
          <div style={{ flex: 1, padding: '0 8px', color: T.color.ink, font: `400 14.5px ${T.font.sans}` }}>
            who introduced sarah at acme<span style={{ display: 'inline-block', width: 2, height: 16, background: T.color.accent, verticalAlign: 'text-bottom', marginLeft: 2, animation: 'wm-blink 0.7s step-end infinite' }} />
          </div>
          <button style={{
            width: 48, height: 48, borderRadius: '50%',
            background: T.color.accent, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}><Icon name="arrowUp" size={20} color="#000" /></button>
        </div>

        {/* Recording — push to talk + gestures */}
        <MicroLabel style={{ marginBottom: 10 }}>holding · push to talk</MicroLabel>
        <div style={{
          position: 'relative', marginBottom: 22,
          padding: 10, borderRadius: 999,
          background: 'rgba(255,196,82,0.06)', border: `1.5px solid ${T.color.accent}`,
          display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 16,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.color.alarm, animation: 'wm-pulse-d 1s ease-in-out infinite' }} />
          <span style={{ font: `600 12px ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.5 }}>0:04</span>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <span style={{ font: `400 13.5px ${T.font.sans}`, color: T.color.t55, fontStyle: 'italic' }}>
              ← slide to cancel
            </span>
          </div>
          <button style={{
            width: 48, height: 48, borderRadius: '50%',
            background: T.color.accent, border: '1.5px solid #000',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            position: 'relative',
            boxShadow: `0 0 30px ${T.color.accent}60`,
            transform: 'scale(1.05)',
          }}>
            <Icon name="mic" size={20} color="#000" />
          </button>
          {/* slide-up to lock affordance */}
          <div style={{
            position: 'absolute', bottom: '110%', right: 18,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            font: `500 10px ${T.font.mono}`, color: T.color.t55, letterSpacing: 0.5,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'wm-drift 1.6s ease-in-out infinite',
            }}>
              <Icon name="lock" size={14} color={T.color.t70} />
            </div>
            <span>slide up</span>
          </div>
        </div>

        {/* Locked hands-free */}
        <MicroLabel style={{ marginBottom: 10 }}>locked · hands-free</MicroLabel>
        <div style={{
          padding: 12, borderRadius: 18,
          background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${T.color.accent}80`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,196,82,0.18)', border: `1px solid ${T.color.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="lock" size={14} color={T.color.accent} />
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
            <VoiceBars active count={20} height={26} color={T.color.accent} />
          </div>
          <span style={{ font: `600 13px ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.5 }}>0:42</span>
          <button style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,107,107,0.12)', border: `1px solid ${T.color.alarm}50`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}><Icon name="trash" size={16} color={T.color.alarm} /></button>
          <button style={{
            width: 48, height: 48, borderRadius: '50%',
            background: T.color.accent, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}><Icon name="arrowUp" size={20} color="#000" /></button>
        </div>
      </ArtboardFrame>
    );
  }

  Object.assign(window, {
    MicOrb,
    VoiceMicStates, VoiceBarsCard, ChatThreadComponent, ChatComposerComponent,
  });
})();
