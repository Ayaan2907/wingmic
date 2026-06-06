// proto-screens-b.jsx — Chat Response, Graph, Person Detail, Company Detail
(function () {
  const T = window.PT;
  const { Icon, Avatar, Pill, EntityTag, VoiceBars, ActivityRow } = window;
  const { PhoneFrame, MobileNav, ChatHeader, MobileTopBar, Eyebrow, ChromeBtn } = window;

  // ── CHAT RESPONSE ────────────────────────────────────────────────────────
  function ScreenChatResponse({ onNavigate }) {
    return (
      <PhoneFrame>
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', color: T.color.ink, fontFamily: T.font.sans }}>
          <ChatHeader status="responded" onNavigate={onNavigate} />
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 130px' }}>
            <div style={{ textAlign: 'center', font: `500 10px ${T.font.mono}`, color: T.color.t30, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 16 }}>— today · 14:30 —</div>
            {/* User bubble */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'inline-block', textAlign: 'left', padding: '11px 14px', borderRadius: '18px 18px 4px 18px', background: T.color.accent, color: '#000', font: `500 14.5px/1.45 ${T.font.sans}`, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000', maxWidth: 260 }}>
                  who was the rust person at acme?
                </div>
                <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30, marginTop: 6, letterSpacing: 0.5 }}>14:32</div>
              </div>
            </div>
            {/* Agent reply */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <Avatar name="W" size={28} square color={T.color.accent} />
              <div style={{ flex: 1, maxWidth: 270 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ font: `700 12px ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.4 }}>wingmic</span>
                  <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30 }}>14:32</span>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '4px 14px 14px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: T.color.t85, font: `400 14.5px/1.55 ${T.font.sans}` }}>
                  <span style={{ color: T.color.accent, fontWeight: 600 }}>Sarah Chen</span> — Rust Lead at <span style={{ color: T.color.blue }}>Acme</span>. You met at <span style={{ color: T.color.t40 }}>DevConnect</span> on Oct 14. She talked edge-config + hot-reloading and you said you'd send your <span style={{ fontFamily: T.font.mono, color: T.color.accent, fontSize: 13 }}>edge-reload</span> repo.
                </div>
                <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30, marginTop: 6, letterSpacing: 0.3 }}>↪ sourced from: voice note 14:32 · 3 commits</div>
              </div>
            </div>
            {/* Embedded person card */}
            <div onClick={() => onNavigate('person')} style={{ marginLeft: 38, marginBottom: 12, padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.025)', border: `1px solid ${T.color.accent}30`, boxShadow: `0 0 40px rgba(255,196,82,0.1)`, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name="Sarah" size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: `700 15px ${T.font.sans}`, color: T.color.ink }}>Sarah Chen</div>
                  <div style={{ font: `400 12px ${T.font.mono}`, color: T.color.t55, marginTop: 2 }}>Rust Lead · Acme Corp</div>
                </div>
                <button style={{ width: 32, height: 32, borderRadius: '50%', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="arrowR" size={14} color={T.color.t70} />
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 12 }}>
                <Pill size="sm">#engineering</Pill>
                <Pill size="sm">#rust</Pill>
                <Pill size="sm" color={T.color.accent}>follow-up · repo</Pill>
              </div>
            </div>
            {/* Actions */}
            <div style={{ marginLeft: 38, display: 'flex', gap: 6 }}>
              <button onClick={() => onNavigate('acts')} style={{ padding: '9px 14px', borderRadius: 999, background: T.color.accent, color: '#000', font: `700 12px ${T.font.sans}`, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000', cursor: 'pointer' }}>Draft follow-up →</button>
              <button onClick={() => onNavigate('person')} style={{ padding: '9px 12px', borderRadius: 999, background: 'transparent', color: T.color.t70, font: `500 12px ${T.font.mono}`, border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer' }}>open card</button>
            </div>
          </div>
          <div style={{ position: 'absolute', left: 16, right: 16, bottom: 28, zIndex: 90 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 16px', borderRadius: 999, background: 'rgba(20,20,22,0.9)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 14px 30px rgba(0,0,0,0.5)' }}>
              <button style={{ width: 32, height: 32, borderRadius: '50%', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={16} color={T.color.t70} /></button>
              <span style={{ flex: 1, font: `400 14.5px ${T.font.sans}`, color: T.color.t40 }}>ask wingmic…</span>
              <button onClick={() => onNavigate('chat-recording')} style={{ width: 44, height: 44, borderRadius: '50%', background: T.color.accent, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Icon name="mic" size={18} color="#000" /></button>
            </div>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  // ── GRAPH ────────────────────────────────────────────────────────────────
  function ScreenGraph({ onNavigate }) {
    const [selected, setSelected] = React.useState('Sarah');
    const nodes = [
      { id: 'You',    x: 185, y: 240, r: 16, type: 'you',     c: T.color.accent },
      { id: 'Sarah',  x: 110, y: 155, r: 11, type: 'person',  c: T.color.accent },
      { id: 'Marcus', x: 260, y: 145, r: 11, type: 'person',  c: T.color.blue },
      { id: 'Priya',  x: 300, y: 290, r: 11, type: 'person',  c: T.color.violet },
      { id: 'Jordan', x: 90,  y: 300, r: 11, type: 'person',  c: T.color.second },
      { id: 'Alex',   x: 200, y: 355, r: 10, type: 'person',  c: T.color.third },
      { id: 'Acme',   x: 80,  y: 205, r: 10, type: 'company', c: T.color.blue },
      { id: 'Neural', x: 320, y: 200, r: 10, type: 'company', c: T.color.blue },
      { id: 'DevConn',x: 185, y: 90,  r: 10, type: 'event',   c: T.color.t40 },
    ];
    const edges = [
      ['You','Sarah'],['You','Marcus'],['You','Priya'],['You','Jordan'],['You','Alex'],
      ['Sarah','Acme'],['Marcus','Neural'],['Priya','Neural'],
      ['Sarah','DevConn'],['Marcus','DevConn'],['You','DevConn'],
    ];
    const [filters, setFilters] = React.useState({ people: true, orgs: true, events: true });
    const selectedNode = nodes.find(n => n.id === selected);
    return (
      <PhoneFrame>
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', color: T.color.ink, fontFamily: T.font.sans }}>
          <div style={{ padding: '8px 20px 10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Eyebrow>graph</Eyebrow>
                <div style={{ font: `800 22px/1 ${T.font.sans}`, letterSpacing: '-0.02em' }}>everyone <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>you know</i></div>
                <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40, marginTop: 4 }}>
                  <span style={{ color: T.color.accent }}>12</span> ppl · <span style={{ color: T.color.blue }}>5</span> orgs · <span style={{ color: T.color.t55 }}>3</span> events
                </div>
              </div>
              <button onClick={() => onNavigate('search')} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="search" size={16} color={T.color.t70} />
              </button>
            </div>
            {/* Filter chips */}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
              {[
                { k: 'people', l: '◉ people', c: T.color.accent },
                { k: 'orgs',   l: '▤ orgs',   c: T.color.blue },
                { k: 'events', l: '◆ events', c: T.color.t40 },
              ].map(f => (
                <button key={f.k} onClick={() => setFilters(p => ({ ...p, [f.k]: !p[f.k] }))} style={{
                  padding: '5px 12px', borderRadius: 999, whiteSpace: 'nowrap', cursor: 'pointer',
                  background: filters[f.k] ? `${f.c}1f` : 'rgba(255,255,255,0.04)',
                  color: filters[f.k] ? f.c : T.color.t55,
                  border: `1px solid ${filters[f.k] ? f.c + '40' : 'rgba(255,255,255,0.08)'}`,
                  font: `600 11px ${T.font.mono}`, letterSpacing: 0.5, textTransform: 'uppercase',
                }}>{f.l}</button>
              ))}
            </div>
          </div>
          {/* SVG Graph */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <svg width="100%" height="100%" viewBox="0 0 393 310" style={{ position: 'absolute', inset: 0 }}>
              <defs>
                <radialGradient id="grbg" cx="50%" cy="50%">
                  <stop offset="0%" stopColor="rgba(255,196,82,0.04)" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
              </defs>
              <rect width="393" height="310" fill="url(#grbg)" />
              {edges.map(([a, b], i) => {
                const na = nodes.find(n => n.id === a), nb = nodes.find(n => n.id === b);
                if (!na || !nb) return null;
                const isYou = a === 'You' || b === 'You';
                return <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke={isYou ? `${T.color.accent}50` : 'rgba(255,255,255,0.12)'} strokeWidth={isYou ? 1.5 : 1} />;
              })}
              {nodes.map(n => {
                const isSelected = n.id === selected;
                const isYou = n.id === 'You';
                const show = n.type === 'you' || (n.type === 'person' && filters.people) || (n.type === 'company' && filters.orgs) || (n.type === 'event' && filters.events);
                if (!show) return null;
                return (
                  <g key={n.id} style={{ cursor: 'pointer' }} onClick={() => {
                    setSelected(n.id);
                    if (n.type === 'person' && n.id !== 'You') onNavigate && null;
                  }}>
                    {isYou && <circle cx={n.x} cy={n.y} r={n.r + 8} fill="none" stroke={T.color.accent} strokeWidth={1} opacity={0.3} style={{ animation: 'wm-pulse-s 3s ease-in-out infinite' }} />}
                    {isSelected && !isYou && <circle cx={n.x} cy={n.y} r={n.r + 5} fill="none" stroke={n.c} strokeWidth={1.5} opacity={0.5} />}
                    {n.type === 'company' ? (
                      <rect x={n.x - n.r} y={n.y - n.r} width={n.r * 2} height={n.r * 2} fill={n.c} rx={2} opacity={isSelected ? 1 : 0.85} />
                    ) : n.type === 'event' ? (
                      <polygon points={`${n.x},${n.y - n.r} ${n.x + n.r},${n.y} ${n.x},${n.y + n.r} ${n.x - n.r},${n.y}`} fill="none" stroke={n.c} strokeWidth={1.5} opacity={0.7} />
                    ) : (
                      <circle cx={n.x} cy={n.y} r={n.r} fill={isYou ? T.color.accent : n.c} opacity={isSelected ? 1 : 0.85} />
                    )}
                    {isYou ? (
                      <text x={n.x} y={n.y + 4} textAnchor="middle" fill="#000" fontSize={9} fontWeight="800" fontFamily={T.font.sans}>YOU</text>
                    ) : (
                      <text x={n.x} y={n.y + n.r + 11} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={8} fontFamily={T.font.mono}>{n.id}</text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          {/* Selected node card */}
          {selectedNode && selectedNode.id !== 'You' && (
            <div onClick={() => { if (selectedNode.type === 'person') onNavigate('person'); else if (selectedNode.type === 'company') onNavigate('company'); else if (selectedNode.type === 'event') onNavigate('event'); }} style={{ position: 'absolute', left: 16, right: 16, bottom: 86, zIndex: 50, padding: '12px 14px', borderRadius: 14, background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(20px)', border: `1px solid ${T.color.accent}40`, boxShadow: `0 0 40px rgba(255,196,82,0.1)`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name={selectedNode.id} size={40} color={selectedNode.c} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: `700 14px ${T.font.sans}`, color: T.color.ink }}>{selectedNode.id}</div>
                <div style={{ font: `400 11px ${T.font.mono}`, color: T.color.t40, marginTop: 2 }}>{selectedNode.type} · {selectedNode.type === 'person' ? '5 edges' : selectedNode.type === 'company' ? '3 you know' : 'oct 14'}</div>
              </div>
              <Pill color={T.color.accent} mono size="sm">◐ warm</Pill>
              <Icon name="arrowR" size={16} color={T.color.t55} />
            </div>
          )}
          <MobileNav active="graph" onNavigate={onNavigate} />
        </div>
      </PhoneFrame>
    );
  }

  // ── PERSON DETAIL ────────────────────────────────────────────────────────
  function ScreenPerson({ onNavigate }) {
    return (
      <PhoneFrame>
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', color: T.color.ink, fontFamily: T.font.sans }}>
          <div style={{ padding: '6px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => onNavigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: T.color.t55 }}>
              <Icon name="arrowL" size={18} color={T.color.t55} /> back
            </button>
            <div style={{ display: 'flex', gap: 6 }}>
              <ChromeBtn icon="graph" onClick={() => onNavigate('graph')} />
              <ChromeBtn icon="settings" onClick={() => onNavigate('settings')} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 100px' }}>
            {/* Hero */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
              <Avatar name="Sarah" size={72} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ font: `700 10px ${T.font.mono}`, color: T.color.accent, letterSpacing: 1.5, textTransform: 'uppercase' }}>◉ person</span>
                  <Pill color={T.color.third} mono size="sm">◐ warm</Pill>
                </div>
                <div style={{ font: `800 22px/1 ${T.font.sans}`, letterSpacing: '-0.025em' }}>Sarah Chen</div>
                <div style={{ font: `400 12px ${T.font.mono}`, color: T.color.t55, marginTop: 4 }}>Rust Lead · Acme Corp</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 16 }}>
              <Pill size="sm">#engineering</Pill>
              <Pill size="sm">#rust</Pill>
              <Pill size="sm" color={T.color.accent}>follow-up</Pill>
              <Pill size="sm">#hot-reload</Pill>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              <button onClick={() => onNavigate('acts')} style={{ flex: 1, padding: '12px', borderRadius: 10, background: T.color.accent, color: '#000', font: `700 13px ${T.font.sans}`, border: '1.5px solid #000', boxShadow: '4px 4px 0 #000', cursor: 'pointer' }}>Draft check-in →</button>
              <button style={{ padding: '12px 18px', borderRadius: 10, background: 'transparent', color: T.color.ink, font: `500 13px ${T.font.sans}`, border: '1.5px solid rgba(255,255,255,0.22)', cursor: 'pointer' }}>edit</button>
            </div>
            {/* Stat trio */}
            <div style={{ display: 'flex', gap: 28, marginBottom: 24 }}>
              {[{ v:'5', l:'edges', c:T.color.accent, r:-1 }, { v:'3', l:'commits', c:T.color.second, r:0.5 }, { v:'7d', l:'since', c:T.color.third, r:-0.5 }].map((s,i) => (
                <div key={i} style={{ transform: `rotate(${s.r}deg)` }}>
                  <div style={{ font: `400 36px/0.9 ${T.font.serif}`, fontStyle: 'italic', color: s.c, letterSpacing: '-0.04em' }}>{s.v}</div>
                  <div style={{ font: `500 9px ${T.font.mono}`, color: T.color.t40, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>
            {/* Captures */}
            <Eyebrow>from your captures</Eyebrow>
            <div style={{ padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 16 }}>
              <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40, letterSpacing: 0.5, marginBottom: 6 }}>14:32 · OCT 14 · DEVCONNECT · 0:42</div>
              <div style={{ font: `400 13.5px/1.55 ${T.font.sans}`, color: T.color.t85, fontStyle: 'italic' }}>
                "She's their rust lead. Talked <span style={{ color: T.color.accent, fontStyle: 'normal', fontWeight: 600 }}>edge-config</span> + hot-reloading. I said I'd send her my <span style={{ fontFamily: T.font.mono, color: T.color.accent, fontStyle: 'normal' }}>edge-reload</span> repo."
              </div>
            </div>
            {/* Follow-ups */}
            <Eyebrow>follow-ups</Eyebrow>
            <div style={{ padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: T.color.accent, border: '1.5px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="check" size={12} color="#000" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ font: `500 13px ${T.font.sans}`, color: T.color.ink }}>Send github.com/me/edge-reload</div>
                <div style={{ font: `400 10.5px ${T.font.mono}`, color: T.color.t40, marginTop: 2 }}>due · tomorrow · drafted</div>
              </div>
            </div>
            {/* Related */}
            <Eyebrow>related</Eyebrow>
            {[
              { name: 'Marcus Rivera', sub: 'co-attended DevConnect', to: 'person', type: 'person' },
              { name: 'Acme Corp',     sub: 'works at',               to: 'company', type: 'company' },
              { name: 'Priya Sharma',  sub: 'overlapping topic',       to: 'person', type: 'person' },
            ].map((r, i) => (
              <div key={i} onClick={() => onNavigate(r.to)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none', cursor: 'pointer' }}>
                <Avatar name={r.name} size={28} square={r.type === 'company'} color={r.type === 'company' ? T.color.blue : undefined} />
                <div style={{ flex: 1 }}>
                  <div style={{ font: `500 13.5px ${T.font.sans}`, color: T.color.ink }}>{r.name}</div>
                  <div style={{ font: `400 11px ${T.font.mono}`, color: T.color.t40 }}>{r.sub}</div>
                </div>
                <Icon name="arrowR" size={14} color={T.color.t40} />
              </div>
            ))}
          </div>
          <MobileNav active="graph" onNavigate={onNavigate} />
        </div>
      </PhoneFrame>
    );
  }

  // ── COMPANY DETAIL ───────────────────────────────────────────────────────
  function ScreenCompany({ onNavigate }) {
    return (
      <PhoneFrame>
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', color: T.color.ink, fontFamily: T.font.sans }}>
          <div style={{ padding: '6px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => onNavigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: T.color.t55 }}>
              <Icon name="arrowL" size={18} color={T.color.t55} /> back
            </button>
            <div style={{ display: 'flex', gap: 6 }}>
              <ChromeBtn icon="graph" onClick={() => onNavigate('graph')} />
              <ChromeBtn icon="pin" onClick={() => {}} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 100px' }}>
            {/* Hero */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: 14, background: T.color.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `900 28px ${T.font.sans}`, color: '#000', boxShadow: '3px 3px 0 rgba(0,0,0,0.3)', flexShrink: 0 }}>A</div>
              <div>
                <div style={{ font: `700 10px ${T.font.mono}`, color: T.color.blue, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>▤ company</div>
                <div style={{ font: `800 22px/1 ${T.font.sans}`, letterSpacing: '-0.025em' }}>Acme <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic' }}>Corp</i></div>
                <div style={{ font: `400 11px ${T.font.mono}`, color: T.color.t55, marginTop: 3 }}>infra · 240 staff · sf</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {['↗ acme.com', '↗ careers', '↗ blog'].map((l, i) => (
                <span key={i} style={{ padding: '5px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', font: `500 11.5px ${T.font.mono}`, color: T.color.t70 }}>{l}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button style={{ flex: 1, padding: '12px', borderRadius: 10, background: T.color.accent, color: '#000', font: `700 13px ${T.font.sans}`, border: '1.5px solid #000', boxShadow: '4px 4px 0 #000', cursor: 'pointer' }}>Find warm path →</button>
              <button style={{ padding: '12px 16px', borderRadius: 10, background: 'transparent', color: T.color.ink, font: `500 12px ${T.font.sans}`, border: '1.5px solid rgba(255,255,255,0.22)', cursor: 'pointer' }}>draft intro</button>
            </div>
            <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
              {[{ v:'3', l:'you know', c:T.color.accent }, { v:'7', l:'commits', c:T.color.second }, { v:'5d', l:'last touch', c:T.color.blue }].map((s,i) => (
                <div key={i}>
                  <div style={{ font: `400 32px/0.9 ${T.font.serif}`, fontStyle: 'italic', color: s.c, letterSpacing: '-0.04em' }}>{s.v}</div>
                  <div style={{ font: `500 9px ${T.font.mono}`, color: T.color.t40, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <Eyebrow color={T.color.blue}>people you know · 3</Eyebrow>
            {[
              { n: 'Sarah Chen',  s: 'Rust Lead · 7d', warm: true },
              { n: 'Tomás López', s: 'Eng Manager' },
              { n: 'Yuki Tanaka', s: 'PM' },
            ].map((p, i) => (
              <div key={i} onClick={() => onNavigate('person')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none', cursor: 'pointer' }}>
                <Avatar name={p.n} size={32} />
                <div style={{ flex: 1 }}>
                  <span style={{ font: `500 13.5px ${T.font.sans}`, color: T.color.ink }}>{p.n}</span>
                  {p.warm && <Pill color={T.color.accent} mono size="sm" style={{ marginLeft: 8 }}>warm</Pill>}
                  <div style={{ font: `400 11px ${T.font.mono}`, color: T.color.t40 }}>{p.s}</div>
                </div>
                <Icon name="arrowR" size={14} color={T.color.t40} />
              </div>
            ))}
            <div style={{ marginTop: 16 }}>
              <Eyebrow>topics discussed</Eyebrow>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <EntityTag kind="concept">edge config</EntityTag>
                <EntityTag kind="concept">hot reloading</EntityTag>
                <EntityTag kind="concept">notify-rs</EntityTag>
                <EntityTag kind="concept">sqlite WAL</EntityTag>
              </div>
            </div>
          </div>
          <MobileNav active="graph" onNavigate={onNavigate} />
        </div>
      </PhoneFrame>
    );
  }

  Object.assign(window, { ScreenChatResponse, ScreenGraph, ScreenPerson, ScreenCompany });
})();
