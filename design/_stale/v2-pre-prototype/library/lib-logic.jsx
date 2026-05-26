// library/lib-logic.jsx — system logic + nav map (answers Ayaan)
(function () {
  const T = window.WMT;
  const { ArtboardFrame, ABTitle, MicroLabel, Icon, Avatar, EntityTag } = window;

  // ── decision callout card ──────────────────────────────────────────────
  function Decision({ tag, title, italic, body, children }) {
    return (
      <div style={{
        padding: 22, borderRadius: 16,
        background: 'rgba(255,196,82,0.06)',
        border: `1px solid ${T.color.accent}40`,
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: -10, left: 16,
          padding: '4px 9px', borderRadius: 4,
          background: T.color.accent, color: '#000',
          font: `700 9.5px ${T.font.mono}`, letterSpacing: 1, textTransform: 'uppercase',
          boxShadow: '2px 2px 0 rgba(0,0,0,0.3)',
        }}>{tag}</div>
        <div style={{ font: `800 22px/1.1 ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.02em', marginTop: 4 }}>
          {title} {italic && <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>{italic}</i>}
        </div>
        <p style={{ font: `400 14px/1.55 ${T.font.sans}`, color: T.color.t70, margin: '10px 0 14px', maxWidth: 460 }}>{body}</p>
        {children}
      </div>
    );
  }

  // ── tiny mic glyph for diagrams ────────────────────────────────────────
  function MicGlyph({ size = 32, active = false }) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: active ? T.color.accent : 'rgba(255,255,255,0.05)',
        border: active ? `1.5px solid ${T.color.accent}` : '1.5px solid rgba(255,255,255,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: active ? `0 0 24px ${T.color.accent}40` : 'none',
        flexShrink: 0,
      }}>
        <Icon name="mic" size={size * 0.45} color={active ? '#000' : T.color.t70} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // PAGE 1 — One mic, one surface
  // ─────────────────────────────────────────────────────────────────────
  function LogicMicSurface() {
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="00.1 / navigation logic" title="One mic. " italic="One surface." lead="Wherever you tap a mic in wingmic, you land in the same place: chat — recording already running. There is no separate capture screen." />

        <Decision
          tag="answers: Ayaan"
          title="The chat page" italic="is the capture page."
          body={
            <>
              Tapping the nav-center mic <strong style={{ color: T.color.ink }}>doesn't open a new screen</strong> — it opens chat with the mic engaged. Holding it on the chat page does the same thing. They're the same final action: capture a moment into the agent's transcript. The agent decides afterwards whether what you said is something to <strong style={{ color: T.color.accent }}>commit</strong> (a person you met) or <strong style={{ color: T.color.accent }}>answer</strong> (a question about who you know).
            </>
          }
        >
          {/* the diagram */}
          <div style={{
            marginTop: 18, padding: 18, borderRadius: 12,
            background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {/* sources */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <MicGlyph size={36} />
                  <div>
                    <div style={{ font: `600 13px ${T.font.sans}`, color: T.color.ink }}>nav · center mic</div>
                    <div style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.t40, marginTop: 2 }}>from any tab</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <MicGlyph size={36} />
                  <div>
                    <div style={{ font: `600 13px ${T.font.sans}`, color: T.color.ink }}>chat · composer mic</div>
                    <div style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.t40, marginTop: 2 }}>tap → start · hold → push-to-talk</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <MicGlyph size={36} />
                  <div>
                    <div style={{ font: `600 13px ${T.font.sans}`, color: T.color.ink }}>OS · long-press app</div>
                    <div style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.t40, marginTop: 2 }}>quick action · siri shortcut</div>
                  </div>
                </div>
              </div>

              {/* arrows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 8px' }}>
                {[0,1,2].map(i => <Icon key={i} name="arrowR" size={20} color={T.color.accent} />)}
              </div>

              {/* funnel */}
              <div style={{
                padding: '18px 22px', borderRadius: 14,
                background: T.color.accent, color: '#000',
                border: '1.5px solid #000', boxShadow: '4px 4px 0 #000',
              }}>
                <div style={{ font: `700 10px ${T.font.mono}`, letterSpacing: 1.5, textTransform: 'uppercase' }}>single surface</div>
                <div style={{ font: `800 18px/1 ${T.font.sans}`, letterSpacing: '-0.02em', marginTop: 4 }}>
                  chat<span style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic' }}> · recording</span>
                </div>
              </div>

              {/* split outputs */}
              <div style={{ padding: '0 10px' }}>
                <div style={{ font: `400 26px ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent, lineHeight: 1 }}>then</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{
                  padding: '10px 13px', borderRadius: 10,
                  background: 'rgba(134,239,172,0.08)', border: `1px solid ${T.color.second}40`,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ font: `700 11px ${T.font.mono}`, color: T.color.second, letterSpacing: 0.5 }}>→ commit</span>
                  <span style={{ font: `400 12px ${T.font.sans}`, color: T.color.t70 }}>writes to graph</span>
                </div>
                <div style={{
                  padding: '10px 13px', borderRadius: 10,
                  background: 'rgba(125,211,252,0.08)', border: `1px solid ${T.color.blue}40`,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ font: `700 11px ${T.font.mono}`, color: T.color.blue, letterSpacing: 0.5 }}>↪ answer</span>
                  <span style={{ font: `400 12px ${T.font.sans}`, color: T.color.t70 }}>reads from graph</span>
                </div>
              </div>
            </div>
          </div>

          {/* example phrases */}
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(134,239,172,0.05)', border: `1px solid ${T.color.second}30` }}>
              <div style={{ font: `700 10px ${T.font.mono}`, color: T.color.second, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>→ commit · examples</div>
              <div style={{ font: `400 13px/1.55 ${T.font.sans}`, color: T.color.t85 }}>
                "met sarah from acme, she's their rust lead"<br />
                "had coffee with marcus, he wants to chat monday"
              </div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(125,211,252,0.05)', border: `1px solid ${T.color.blue}30` }}>
              <div style={{ font: `700 10px ${T.font.mono}`, color: T.color.blue, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>↪ answer · examples</div>
              <div style={{ font: `400 13px/1.55 ${T.font.sans}`, color: T.color.t85 }}>
                "who was the rust person at acme?"<br />
                "remind me what priya works on"
              </div>
            </div>
          </div>
        </Decision>
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // PAGE 2 — Nav map
  // ─────────────────────────────────────────────────────────────────────
  function NavTile({ icon, label, sub, dest, color = T.color.accent, isMic }) {
    return (
      <div style={{
        padding: 16, borderRadius: 14,
        background: isMic ? `${color}10` : 'rgba(255,255,255,0.025)',
        border: isMic ? `1.5px solid ${color}` : '1px solid rgba(255,255,255,0.06)',
        position: 'relative',
        boxShadow: isMic ? `0 0 40px ${color}20` : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 42, height: 42, borderRadius: isMic ? '50%' : 10,
            background: isMic ? color : 'rgba(255,255,255,0.04)',
            border: isMic ? '1.5px solid #000' : '1px solid rgba(255,255,255,0.08)',
            boxShadow: isMic ? '3px 3px 0 #000' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={icon} size={20} color={isMic ? '#000' : color} />
          </div>
          <div>
            <div style={{ font: `700 14px ${T.font.sans}`, color: T.color.ink, letterSpacing: -0.2 }}>{label}</div>
            <div style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.t40, letterSpacing: 0.4, marginTop: 2 }}>{sub}</div>
          </div>
        </div>
        <div style={{ font: `400 12.5px/1.45 ${T.font.sans}`, color: T.color.t70 }}>{dest}</div>
      </div>
    );
  }

  function LogicNavMap() {
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="00.2 / navigation map" title="Five tabs. " italic="One verb each." lead="Every nav slot maps to one verb. The center mic is the only one that mutates state on tap." />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10,
        }}>
          <NavTile icon="home"  label="home"    sub="see"     dest="today's stats, pending acts, recent commits — the morning briefing" />
          <NavTile icon="chat"  label="chat"    sub="talk"    dest="full thread w/ wingmic — text or voice, capture or query" />
          <NavTile icon="mic"   label="capture" sub="record"  dest="opens chat with mic engaged · only nav slot that triggers an action on tap" isMic />
          <NavTile icon="graph" label="graph"   sub="explore" dest="force-directed people graph — filter, tap nodes, follow edges" color={T.color.blue} />
          <NavTile icon="bell"  label="acts"    sub="approve" dest="agent's queued drafts — check-ins, intros, reminders awaiting send" color={T.color.violet} />
        </div>

        <div style={{ marginTop: 26, padding: 18, borderRadius: 12, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <MicroLabel style={{ marginBottom: 10 }}>rules</MicroLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {[
              { k: '01', r: <>Only the <span style={{ color: T.color.accent, fontFamily: T.font.mono }}>mic</span> tab acts on tap. Every other tab navigates.</> },
              { k: '02', r: <>Mic from anywhere goes to <span style={{ color: T.color.accent, fontFamily: T.font.mono }}>chat</span>. Back arrow returns to where you were.</> },
              { k: '03', r: <>Chat is bidirectional — capture (write) and query (read) live in the same thread.</> },
              { k: '04', r: <>Acts is the only screen that pushes notifications. Everywhere else is pulled.</> },
            ].map(rule => (
              <div key={rule.k} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <span style={{ font: `400 28px ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent, lineHeight: 1, letterSpacing: '-0.04em' }}>{rule.k}</span>
                <span style={{ flex: 1, font: `400 13.5px/1.5 ${T.font.sans}`, color: T.color.t70 }}>{rule.r}</span>
              </div>
            ))}
          </div>
        </div>
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // PAGE 3 — Flow storyboard: hold → release → branch
  // ─────────────────────────────────────────────────────────────────────
  function FlowStep({ n, label, body, micState = 'idle', children }) {
    const { MicOrb } = window;
    return (
      <div style={{
        padding: 18, borderRadius: 14, flex: 1,
        background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
        position: 'relative', minHeight: 320,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
          <span style={{ font: `400 36px ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent, letterSpacing: '-0.04em', lineHeight: 1 }}>{n}</span>
          <span style={{ font: `700 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 1.5, textTransform: 'uppercase' }}>{label}</span>
        </div>
        <div style={{ font: `400 13px/1.5 ${T.font.sans}`, color: T.color.t70, marginBottom: 16 }}>{body}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          {micState && <MicOrb size={76} state={micState} />}
        </div>
        {children}
      </div>
    );
  }

  function LogicFlowStoryboard() {
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="00.3 / flow" title="The whole journey, " italic="in four moves." lead="Hold the mic anywhere → land in chat → release or lock → agent branches." />

        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
          <FlowStep
            n="01"
            label="invitation"
            body="resting · home tab · nav mic visible · idle"
            micState="idle"
          >
            <div style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.t40, textAlign: 'center', letterSpacing: 0.3 }}>tap or hold</div>
          </FlowStep>

          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Icon name="arrowR" size={22} color={T.color.accent} />
          </div>

          <FlowStep
            n="02"
            label="recording"
            body="chat opens · mic active · transcript streaming · slide-up to lock, slide-left to cancel"
            micState="recording"
          >
            <div style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.accent, textAlign: 'center', letterSpacing: 0.3 }}>0:12 · live</div>
          </FlowStep>

          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Icon name="arrowR" size={22} color={T.color.accent} />
          </div>

          <FlowStep
            n="03"
            label="thinking"
            body="release · agent classifies intent · streams reasoning"
            micState="thinking"
          >
            <div style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.t40, textAlign: 'center', letterSpacing: 0.3 }}>extracting · 1.4k nodes</div>
          </FlowStep>

          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Icon name="arrowR" size={22} color={T.color.accent} />
          </div>

          <FlowStep
            n="04"
            label="branches"
            body="commit (new person/edge) OR answer (excerpt + sources)"
            micState="done"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ padding: '6px 10px', borderRadius: 8, background: `${T.color.second}15`, border: `1px solid ${T.color.second}40`, font: `700 10px ${T.font.mono}`, color: T.color.second, letterSpacing: 0.4, textTransform: 'uppercase' }}>→ commit · sarah_chen</div>
              <div style={{ padding: '6px 10px', borderRadius: 8, background: `${T.color.blue}15`, border: `1px solid ${T.color.blue}40`, font: `700 10px ${T.font.mono}`, color: T.color.blue, letterSpacing: 0.4, textTransform: 'uppercase' }}>↪ answer · 92% conf</div>
            </div>
          </FlowStep>
        </div>

        {/* below: simplification statement */}
        <div style={{
          marginTop: 24, padding: 16, borderRadius: 12,
          background: 'rgba(255,143,171,0.06)', border: `1px solid ${T.color.third}40`,
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: T.color.third, color: '#000',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            font: `800 13px ${T.font.mono}`,
          }}>✂</div>
          <div>
            <div style={{ font: `700 11px ${T.font.mono}`, color: T.color.third, letterSpacing: 1.5, textTransform: 'uppercase' }}>simplification</div>
            <div style={{ font: `400 13.5px/1.55 ${T.font.sans}`, color: T.color.t85, marginTop: 4 }}>
              The old "Capture" screen has been collapsed into Chat. There is no separate capture surface — the chat thread carries both your spoken commits and your typed questions. One inbox. One transcript. One mental model.
            </div>
          </div>
        </div>
      </ArtboardFrame>
    );
  }

  Object.assign(window, { LogicMicSurface, LogicNavMap, LogicFlowStoryboard });
})();
