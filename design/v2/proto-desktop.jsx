// proto-desktop.jsx — Desktop screens (Home, Chat, Graph, Person)
(function () {
  const T = window.PT;
  const { Icon, Avatar, Pill, EntityTag, VoiceBars, ActivityRow } = window;
  const { DesktopFrame, Sidebar, Eyebrow } = window;

  const DESKTOP_H = 680;

  // ── shared desktop content wrapper ──────────────────────────────────────
  function DContent({ children, style }) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 36px', background: T.color.bg, backgroundImage: 'radial-gradient(ellipse at 18% 0%, rgba(255,196,82,0.04) 0%, transparent 55%), radial-gradient(ellipse at 82% 100%, rgba(255,107,107,0.025) 0%, transparent 55%)', height: '100%', ...style }}>
        {children}
      </div>
    );
  }

  // ── DESKTOP HOME ─────────────────────────────────────────────────────────
  function ScreenDesktopHome({ onNavigate }) {
    return (
      <div style={{ width: '100%', height: DESKTOP_H }}>
        <DesktopFrame>
          <div style={{ display: 'flex', width: '100%', height: DESKTOP_H - 40 }}>
            <Sidebar active="desktop-home" onNavigate={onNavigate} />
            <DContent>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                  <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>◆ today · mon · oct 21</div>
                  <div style={{ font: `900 44px/0.95 ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.035em' }}>
                    morning, <i style={{ font: `400 1em/0.95 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>morgan.</i>
                  </div>
                  <div style={{ font: `400 15px/1.5 ${T.font.sans}`, color: T.color.t55, marginTop: 10 }}>The agent did its sweep at 06:12. Five drafts waiting.</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.color.second, animation: 'wm-pulse-d 1.6s infinite' }} />
                  <span style={{ font: `500 11.5px ${T.font.mono}`, color: T.color.t55, letterSpacing: 0.3 }}>graph synced</span>
                </div>
              </div>
              {/* Stat quartet */}
              <div style={{ display: 'flex', gap: 48, marginBottom: 36 }}>
                {[
                  { v: '12', l: 'people', c: T.color.accent, r: -2 },
                  { v: '3',  l: 'acts',   c: T.color.second, r: 1 },
                  { v: '4',  l: 'today',  c: T.color.third,  r: -1 },
                  { v: '92%',l: 'recall', c: T.color.violet,  r: 0.5 },
                ].map((s, i) => (
                  <div key={i} style={{ transform: `rotate(${s.r}deg)` }}>
                    <div style={{ font: `400 64px/0.85 ${T.font.serif}`, fontStyle: 'italic', color: s.c, letterSpacing: '-0.04em', animation: 'wm-drift 5s ease-in-out infinite' }}>{s.v}</div>
                    <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40, letterSpacing: 1.8, marginTop: 8, textTransform: 'uppercase' }}>{s.l}</div>
                  </div>
                ))}
              </div>
              {/* 2-col body */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24 }}>
                {/* Acts col */}
                <div>
                  <div style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>◆ acts · pending</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { kind: '↗ check-in', name: 'Sarah Chen',    why: '7d since DevConnect · repo promised', conf: 92, color: T.color.accent },
                      { kind: '◷ reminder', name: 'Marcus Rivera', why: 'Coffee Mon · no invite yet',           conf: 88, color: T.color.blue },
                      { kind: '⇌ intro',    name: 'Priya → Deepak', why: 'Both work on voice + MCP',           conf: 74, color: T.color.violet },
                    ].map((a, i) => (
                      <div key={i} onClick={() => onNavigate('desktop-acts')} style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                        <Avatar name={a.name} size={44} square color={a.color} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                            <span style={{ font: `700 10px ${T.font.mono}`, color: a.color, letterSpacing: 0.5, textTransform: 'uppercase' }}>{a.kind}</span>
                            <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40 }}>· {a.conf}%</span>
                          </div>
                          <div style={{ font: `600 14.5px ${T.font.sans}`, color: T.color.ink }}>{a.name}</div>
                          <div style={{ font: `400 12px ${T.font.sans}`, color: T.color.t55 }}>{a.why}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <button style={{ padding: '7px 14px', borderRadius: 8, background: T.color.accent, color: '#000', font: `700 12px ${T.font.sans}`, border: '1.5px solid #000', boxShadow: '2px 2px 0 #000', cursor: 'pointer' }}>send →</button>
                          <button style={{ padding: '6px 12px', borderRadius: 8, background: 'transparent', color: T.color.t55, font: `500 11px ${T.font.mono}`, border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}>edit</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Right col */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Mini graph */}
                  <div style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>◆ graph preview</div>
                    <svg width="100%" height={160} viewBox="0 0 280 160" onClick={() => onNavigate('desktop-graph')} style={{ cursor: 'pointer' }}>
                      {[['185,80','110,38'],['185,80','260,42'],['185,80','300,110'],['185,80','90,118'],['110,38','40,70'],['260,42','300,110']].map(([a,b],i) => {
                        const [ax,ay] = a.split(','); const [bx,by] = b.split(',');
                        return <line key={i} x1={ax} y1={ay} x2={bx} y2={by} stroke={`${T.color.accent}40`} strokeWidth={1} />;
                      })}
                      {[
                        { cx:185,cy:80,r:12,fill:T.color.accent,label:'You' },
                        { cx:110,cy:38,r:8,fill:T.color.accent,label:'Sarah' },
                        { cx:260,cy:42,r:8,fill:T.color.blue,label:'Marcus' },
                        { cx:300,cy:110,r:8,fill:T.color.violet,label:'Priya' },
                        { cx:90,cy:118,r:8,fill:T.color.second,label:'Jordan' },
                        { cx:40,cy:70,r:7,fill:T.color.blue,label:'Acme' },
                      ].map((n,i) => (
                        <g key={i}>
                          <circle cx={n.cx} cy={n.cy} r={n.r} fill={n.fill} opacity={0.9} />
                          <text x={n.cx} y={n.cy+n.r+10} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={7} fontFamily={T.font.mono}>{n.label}</text>
                        </g>
                      ))}
                    </svg>
                  </div>
                  {/* Recent commits */}
                  <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>◆ recent commits</div>
                    <ActivityRow who="sarah_chen" what="commit" detail="met @ DevConnect · 4 edges" time="14:32" color={T.color.accent} />
                    <ActivityRow who="marcus_r" what="enriched" detail="sightglass coffee · 9am" time="15:10" color={T.color.blue} />
                    <ActivityRow who="priya_s" what="commit" detail="diarization paper" time="16:45" color={T.color.violet} last />
                  </div>
                </div>
              </div>
            </DContent>
          </div>
        </DesktopFrame>
      </div>
    );
  }

  // ── DESKTOP CHAT ─────────────────────────────────────────────────────────
  function ScreenDesktopChat({ onNavigate }) {
    return (
      <div style={{ width: '100%', height: DESKTOP_H }}>
        <DesktopFrame>
          <div style={{ display: 'flex', width: '100%', height: DESKTOP_H - 40 }}>
            <Sidebar active="desktop-chat" onNavigate={onNavigate} />
            {/* Thread */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.06)', background: T.color.bg }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name="W" size={32} square color={T.color.accent} />
                <div>
                  <div style={{ font: `700 14px ${T.font.sans}`, color: T.color.ink }}>wingmic</div>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.color.second, animation: 'wm-pulse-d 1.6s infinite' }} />
                    <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40 }}>reading 1,247 nodes</span>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 100px' }}>
                <div style={{ textAlign: 'center', font: `500 10px ${T.font.mono}`, color: T.color.t30, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>— today · 14:30 —</div>
                {/* Messages */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                  <div style={{ textAlign: 'right', maxWidth: 380 }}>
                    <div style={{ display: 'inline-block', textAlign: 'left', padding: '11px 15px', borderRadius: '18px 18px 4px 18px', background: T.color.accent, color: '#000', font: `500 14.5px/1.45 ${T.font.sans}`, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000' }}>who was the rust person at acme?</div>
                    <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30, marginTop: 5, letterSpacing: 0.5 }}>14:32</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <Avatar name="W" size={30} square color={T.color.accent} />
                  <div style={{ maxWidth: 420 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ font: `700 12px ${T.font.mono}`, color: T.color.accent }}>wingmic</span>
                      <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30 }}>14:32</span>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: '4px 14px 14px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: T.color.t85, font: `400 14.5px/1.55 ${T.font.sans}` }}>
                      <span style={{ color: T.color.accent, fontWeight: 600 }}>Sarah Chen</span> — Rust Lead at <span style={{ color: T.color.blue }}>Acme</span>. You met at DevConnect on Oct 14. She talked edge-config + hot-reloading.
                    </div>
                    <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30, marginTop: 5 }}>↪ sourced from: voice note 14:32 · 3 commits</div>
                  </div>
                </div>
              </div>
              {/* Composer */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ flex: 1, font: `400 14.5px ${T.font.sans}`, color: T.color.t30 }}>ask wingmic, or hold the mic to capture a new contact…</span>
                  <span style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.t30, padding: '3px 7px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.1)' }}>⌘ K</span>
                  <button style={{ width: 40, height: 40, borderRadius: '50%', background: T.color.accent, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Icon name="mic" size={18} color="#000" />
                  </button>
                </div>
              </div>
            </div>
            {/* Entity rail */}
            <div style={{ width: 320, background: 'rgba(255,255,255,0.01)', borderLeft: '1px solid rgba(255,255,255,0.06)', padding: '20px 16px', overflowY: 'auto' }}>
              <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>◆ in this thread</div>
              {/* Active person card */}
              <div onClick={() => onNavigate('desktop-person')} style={{ padding: 14, borderRadius: 12, background: `${T.color.accent}0a`, border: `1px solid ${T.color.accent}30`, marginBottom: 16, cursor: 'pointer' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  <Avatar name="Sarah" size={42} />
                  <div>
                    <div style={{ font: `700 14px ${T.font.sans}`, color: T.color.ink }}>Sarah Chen</div>
                    <div style={{ font: `400 11.5px ${T.font.mono}`, color: T.color.t55 }}>Rust Lead · Acme Corp</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  <Pill size="sm">#rust</Pill>
                  <Pill size="sm" color={T.color.accent}>follow-up</Pill>
                </div>
              </div>
              {/* Extracted */}
              <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>extracted</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                <EntityTag kind="person">sarah chen</EntityTag>
                <EntityTag kind="company">acme corp</EntityTag>
                <EntityTag kind="event">DevConnect</EntityTag>
                <EntityTag kind="concept">edge config</EntityTag>
              </div>
              {/* Sources */}
              <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>sources</div>
              {['↪ voice note · 14:32', '↪ commit · oct 14', '↪ follow-up · open'].map((s, i) => (
                <div key={i} style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', letterSpacing: 0.3 }}>{s}</div>
              ))}
            </div>
          </div>
        </DesktopFrame>
      </div>
    );
  }

  // ── DESKTOP GRAPH ────────────────────────────────────────────────────────
  function ScreenDesktopGraph({ onNavigate }) {
    const [sel, setSel] = React.useState('Sarah');
    const nodes = [
      { id:'You',    x:400,y:280,r:14,type:'you',   c:T.color.accent },
      { id:'Sarah',  x:250,y:160,r:10,type:'person', c:T.color.accent },
      { id:'Marcus', x:540,y:145,r:10,type:'person', c:T.color.blue },
      { id:'Priya',  x:580,y:360,r:10,type:'person', c:T.color.violet },
      { id:'Jordan', x:200,y:370,r:10,type:'person', c:T.color.second },
      { id:'Alex',   x:380,y:440,r:9, type:'person', c:T.color.third },
      { id:'Acme',   x:140,y:240,r:9, type:'company',c:T.color.blue },
      { id:'Neural', x:630,y:230,r:9, type:'company',c:T.color.blue },
      { id:'DevConn',x:390,y:70, r:9, type:'event',  c:T.color.t40 },
    ];
    const edges = [['You','Sarah'],['You','Marcus'],['You','Priya'],['You','Jordan'],['You','Alex'],['Sarah','Acme'],['Marcus','Neural'],['Priya','Neural'],['Sarah','DevConn'],['You','DevConn'],['Marcus','DevConn']];
    const selNode = nodes.find(n => n.id === sel);
    return (
      <div style={{ width: '100%', height: DESKTOP_H }}>
        <DesktopFrame>
          <div style={{ display: 'flex', width: '100%', height: DESKTOP_H - 40 }}>
            <Sidebar active="desktop-graph" onNavigate={onNavigate} />
            {/* Canvas */}
            <div style={{ flex: 1, position: 'relative', background: T.color.bg, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 12, left: 16, display: 'flex', gap: 6 }}>
                {[{ l:'◉ people', c:T.color.accent }, { l:'▤ orgs', c:T.color.blue }, { l:'◆ events', c:T.color.t40 }].map((f,i) => (
                  <span key={i} style={{ padding: '5px 12px', borderRadius: 999, background: `${f.c}1f`, border: `1px solid ${f.c}40`, font: `600 11px ${T.font.mono}`, color: f.c, textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.l}</span>
                ))}
              </div>
              <svg width="100%" height="100%" viewBox="0 0 800 560">
                <defs>
                  <radialGradient id="dgbg" cx="50%" cy="50%">
                    <stop offset="0%" stopColor="rgba(255,196,82,0.04)" />
                    <stop offset="100%" stopColor="transparent" />
                  </radialGradient>
                </defs>
                <rect width="800" height="560" fill="url(#dgbg)" />
                {edges.map(([a,b],i) => {
                  const na = nodes.find(n=>n.id===a), nb = nodes.find(n=>n.id===b);
                  return <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke={(a==='You'||b==='You') ? `${T.color.accent}50` : 'rgba(255,255,255,0.12)'} strokeWidth={(a==='You'||b==='You') ? 1.5 : 1} />;
                })}
                {nodes.map(n => (
                  <g key={n.id} onClick={() => setSel(n.id)} style={{ cursor: 'pointer' }}>
                    {n.id===sel && <circle cx={n.x} cy={n.y} r={n.r+6} fill="none" stroke={n.c} strokeWidth={1.5} opacity={0.5} />}
                    {n.type==='company' ? <rect x={n.x-n.r} y={n.y-n.r} width={n.r*2} height={n.r*2} fill={n.c} rx={2} opacity={0.85} />
                      : n.type==='event' ? <polygon points={`${n.x},${n.y-n.r} ${n.x+n.r},${n.y} ${n.x},${n.y+n.r} ${n.x-n.r},${n.y}`} fill="none" stroke={n.c} strokeWidth={1.5} opacity={0.7} />
                      : <circle cx={n.x} cy={n.y} r={n.r} fill={n.c} opacity={0.9} />}
                    {n.id==='You' ? <text x={n.x} y={n.y+4} textAnchor="middle" fill="#000" fontSize={8} fontWeight="800" fontFamily={T.font.sans}>YOU</text>
                      : <text x={n.x} y={n.y+n.r+12} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={9} fontFamily={T.font.mono}>{n.id}</text>}
                  </g>
                ))}
              </svg>
            </div>
            {/* Detail pane */}
            <div style={{ width: 320, borderLeft: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)', padding: '20px 18px', overflowY: 'auto' }}>
              {selNode && (
                <>
                  <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>◉ selected</div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                    <Avatar name={selNode.id} size={56} color={selNode.c} />
                    <div>
                      <div style={{ font: `800 18px ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.02em' }}>{selNode.id}</div>
                      <Pill color={T.color.third} mono size="sm" style={{ marginTop: 4 }}>◐ warm</Pill>
                    </div>
                  </div>
                  <div style={{ font: `400 12px ${T.font.mono}`, color: T.color.t55, marginBottom: 14 }}>{selNode.type} · {selNode.type === 'person' ? 'Rust Lead · Acme' : selNode.type === 'company' ? '3 you know' : 'oct 14'}</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                    <button onClick={() => onNavigate('desktop-person')} style={{ flex: 1, padding: '10px', borderRadius: 10, background: T.color.accent, color: '#000', font: `700 12.5px ${T.font.sans}`, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000', cursor: 'pointer' }}>Draft check-in →</button>
                    <button style={{ padding: '10px 14px', borderRadius: 10, background: 'transparent', color: T.color.t55, font: `500 12px ${T.font.mono}`, border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer' }}>open</button>
                  </div>
                  <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>◆ edges · 5</div>
                  {[{ r:'works_at', n:'Acme Corp', c:T.color.blue }, { r:'met_at', n:'DevConnect', c:T.color.t40 }, { r:'knows', n:'Marcus Rivera', c:T.color.blue }, { r:'discussed', n:'edge config', c:T.color.violet }].map((e,i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, background: `${T.color.accent}15`, font: `600 9px ${T.font.mono}`, color: T.color.accent, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>{e.r}</span>
                      <span style={{ font: `500 12.5px ${T.font.sans}`, color: T.color.t70 }}>{e.n}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </DesktopFrame>
      </div>
    );
  }

  // ── DESKTOP PERSON ────────────────────────────────────────────────────────
  function ScreenDesktopPerson({ onNavigate }) {
    return (
      <div style={{ width: '100%', height: DESKTOP_H }}>
        <DesktopFrame>
          <div style={{ display: 'flex', width: '100%', height: DESKTOP_H - 40 }}>
            <Sidebar active="desktop-graph" onNavigate={onNavigate} />
            {/* List col */}
            <div style={{ width: 280, borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)', overflowY: 'auto' }}>
              <div style={{ padding: '16px 14px 8px' }}>
                <div style={{ display: 'flex', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 10 }}>
                  <Icon name="search" size={14} color={T.color.t40} />
                  <span style={{ font: `400 13px ${T.font.sans}`, color: T.color.t30 }}>filter people…</span>
                </div>
              </div>
              {[
                { n: 'Sarah Chen',    s: 'Rust Lead · Acme',   warm: true,  active: true },
                { n: 'Marcus Rivera', s: 'CTO · Dataweave',    warm: false, active: false },
                { n: 'Priya Sharma',  s: 'ML Eng · NeuralPath', warm: true, active: false },
                { n: 'Jordan Kim',    s: 'Founder · Glitch',   warm: false, active: false },
                { n: 'Alex Novak',    s: 'Eng · Stripe',       warm: false, active: false },
              ].map((p, i) => (
                <div key={i} style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', background: p.active ? 'rgba(255,196,82,0.08)' : 'transparent', borderLeft: p.active ? `3px solid ${T.color.accent}` : '3px solid transparent' }}>
                  <Avatar name={p.n} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: `500 13.5px ${T.font.sans}`, color: p.active ? T.color.ink : T.color.t70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.n}</div>
                    <div style={{ font: `400 11px ${T.font.mono}`, color: T.color.t40 }}>{p.s}</div>
                  </div>
                  {p.warm && <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.color.accent, flexShrink: 0 }} />}
                </div>
              ))}
            </div>
            {/* Detail */}
            <DContent>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 28 }}>
                <div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
                    <Avatar name="Sarah" size={72} />
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ font: `700 10px ${T.font.mono}`, color: T.color.accent, letterSpacing: 1.5, textTransform: 'uppercase' }}>◉ person</span>
                        <Pill color={T.color.third} mono size="sm">◐ warm</Pill>
                      </div>
                      <div style={{ font: `800 28px/1 ${T.font.sans}`, letterSpacing: '-0.025em', color: T.color.ink }}>Sarah Chen</div>
                      <div style={{ font: `400 13px ${T.font.mono}`, color: T.color.t55, marginTop: 5 }}>Rust Lead · Acme Corp</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                        <Pill>#engineering</Pill><Pill>#rust</Pill><Pill color={T.color.accent}>follow-up</Pill>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                    <button style={{ padding: '11px 22px', borderRadius: 10, background: T.color.accent, color: '#000', font: `700 14px ${T.font.sans}`, border: '1.5px solid #000', boxShadow: '4px 4px 0 #000', cursor: 'pointer' }}>Draft check-in →</button>
                    <button style={{ padding: '11px 18px', borderRadius: 10, background: 'transparent', color: T.color.ink, font: `500 13px ${T.font.sans}`, border: '1.5px solid rgba(255,255,255,0.22)', cursor: 'pointer' }}>edit</button>
                  </div>
                  <div style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>◆ from your captures</div>
                  <div style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 16 }}>
                    <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40, marginBottom: 8 }}>14:32 · OCT 14 · DEVCONNECT · 0:42</div>
                    <div style={{ font: `400 14px/1.55 ${T.font.sans}`, color: T.color.t85, fontStyle: 'italic' }}>
                      "She's their rust lead. Talked <span style={{ color: T.color.accent, fontStyle: 'normal', fontWeight: 600 }}>edge-config</span> + hot-reloading. I said I'd send her my <span style={{ fontFamily: T.font.mono, color: T.color.accent, fontStyle: 'normal' }}>edge-reload</span> repo."
                    </div>
                  </div>
                  <div style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>◆ follow-ups</div>
                  <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: T.color.accent, border: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name="check" size={12} color="#000" />
                    </div>
                    <div>
                      <div style={{ font: `500 13.5px ${T.font.sans}`, color: T.color.ink }}>Send github.com/me/edge-reload</div>
                      <div style={{ font: `400 11px ${T.font.mono}`, color: T.color.t40, marginTop: 2 }}>due · tomorrow · drafted by agent</div>
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', gap: 32, marginBottom: 28 }}>
                    {[{ v:'5', l:'edges', c:T.color.accent }, { v:'3', l:'commits', c:T.color.second }, { v:'7d', l:'since', c:T.color.third }].map((s,i) => (
                      <div key={i}>
                        <div style={{ font: `400 44px/0.9 ${T.font.serif}`, fontStyle: 'italic', color: s.c, letterSpacing: '-0.04em' }}>{s.v}</div>
                        <div style={{ font: `500 9px ${T.font.mono}`, color: T.color.t40, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 6 }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.t30, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>◆ related</div>
                  {[{ n:'Marcus Rivera', s:'co-attended DevConnect' }, { n:'Acme Corp', s:'works at' }, { n:'Priya Sharma', s:'overlapping topic' }].map((r,i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                      <Avatar name={r.n} size={28} />
                      <div style={{ flex: 1 }}>
                        <div style={{ font: `500 13px ${T.font.sans}`, color: T.color.t85 }}>{r.n}</div>
                        <div style={{ font: `400 10.5px ${T.font.mono}`, color: T.color.t40 }}>{r.s}</div>
                      </div>
                      <Icon name="arrowR" size={14} color={T.color.t30} />
                    </div>
                  ))}
                </div>
              </div>
            </DContent>
          </div>
        </DesktopFrame>
      </div>
    );
  }

  Object.assign(window, { ScreenDesktopHome, ScreenDesktopChat, ScreenDesktopGraph, ScreenDesktopPerson });
})();
