// library/lib-capture-variants.jsx — graph/person/acts/search/settings + 3 capture variants
(function () {
  const T = window.WMT;
  const { Pill, Avatar, EntityTag, VoiceBars, Icon, ArtCenter, MobileNav, MicOrb } = window;

  // ─────────────────────────────────────────────────────────────────────
  // 7. GRAPH
  // ─────────────────────────────────────────────────────────────────────
  function GraphCanvas() {
    // SVG-based static depiction (no canvas → easier to render in design canvas)
    const W = 360, H = 460;
    const cx = W / 2, cy = H / 2 - 20;

    const nodes = [
      { id: 'you',   x: cx, y: cy, r: 18, label: 'You', color: T.color.accent, self: true },
      { id: 'sara',  x: cx - 110, y: cy - 90, r: 13, label: 'Sarah', color: T.color.accent },
      { id: 'marc',  x: cx + 100, y: cy - 70, r: 12, label: 'Marcus', color: T.color.blue },
      { id: 'priy',  x: cx + 120, y: cy + 60, r: 12, label: 'Priya', color: T.color.violet },
      { id: 'alex',  x: cx - 70,  y: cy + 110, r: 11, label: 'Alex', color: T.color.third },
      { id: 'jord',  x: cx + 40,  y: cy - 130, r: 11, label: 'Jordan', color: T.color.second },
      { id: 'acme',  x: cx - 145, y: cy + 20, r: 10, label: 'Acme', color: T.color.blue, sq: true },
      { id: 'data',  x: cx + 145, y: cy - 10, r: 10, label: 'Dataweave', color: T.color.blue, sq: true },
      { id: 'neural', x: cx + 160, y: cy + 130, r: 10, label: 'NeuralPath', color: T.color.violet, sq: true },
      { id: 'dev',   x: cx - 20,  y: cy - 175, r: 8, label: 'DevConnect', color: T.color.t40, dm: true },
    ];
    const edges = [
      ['you','sara'],['you','marc'],['you','priy'],['you','alex'],['you','jord'],
      ['sara','acme'],['marc','data'],['priy','neural'],
      ['sara','dev'],['marc','dev'],['jord','dev'],
      ['sara','marc'],['priy','jord'],
    ];
    const nmap = Object.fromEntries(nodes.map(n => [n.id, n]));

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
        <defs>
          <radialGradient id="bgglow" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor={T.color.accent} stopOpacity="0.08" />
            <stop offset="100%" stopColor={T.color.accent} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} fill="url(#bgglow)" />
        {/* edges */}
        {edges.map(([a, b], i) => {
          const A = nmap[a], B = nmap[b];
          return (
            <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                  stroke={A.id === 'you' || B.id === 'you' ? `${T.color.accent}50` : 'rgba(255,255,255,0.12)'}
                  strokeWidth={A.id === 'you' || B.id === 'you' ? 1.5 : 1} />
          );
        })}
        {/* nodes */}
        {nodes.map(n => (
          <g key={n.id}>
            {n.self && (
              <circle cx={n.x} cy={n.y} r={n.r + 8} fill="none" stroke={n.color} strokeWidth="1" opacity="0.25">
                <animate attributeName="r" values={`${n.r+8};${n.r+14};${n.r+8}`} dur="3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.25;0.05;0.25" dur="3s" repeatCount="indefinite" />
              </circle>
            )}
            {n.sq ? (
              <rect x={n.x - n.r} y={n.y - n.r} width={n.r * 2} height={n.r * 2} fill={n.color} opacity={n.self ? 1 : 0.85} rx="2" />
            ) : n.dm ? (
              <polygon points={`${n.x},${n.y-n.r} ${n.x+n.r},${n.y} ${n.x},${n.y+n.r} ${n.x-n.r},${n.y}`} fill="none" stroke={n.color} strokeWidth="1.5" />
            ) : (
              <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} opacity={n.self ? 1 : 0.9} />
            )}
            {n.self ? (
              <text x={n.x} y={n.y + 4} textAnchor="middle" fontFamily={T.font.sans} fontSize="11" fontWeight="800" fill="#000">You</text>
            ) : (
              <text x={n.x} y={n.y + n.r + 14} textAnchor="middle" fontFamily={T.font.mono} fontSize="9" fill="rgba(255,255,255,0.6)" letterSpacing="0.3">{n.label}</text>
            )}
          </g>
        ))}
      </svg>
    );
  }

  function ScreenGraph() {
    return (
      <ArtCenter>
        <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
          {/* header */}
          <div style={{ padding: '4px 20px 12px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>◆ graph</div>
              <div style={{ font: `800 26px/1 ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.02em' }}>
                everyone <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>you know</i>
              </div>
              <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40, letterSpacing: 0.6, marginTop: 4 }}>
                <span style={{ color: T.color.accent }}>12</span> people · <span style={{ color: T.color.blue }}>5</span> orgs · <span style={{ color: T.color.t55 }}>3</span> events
              </div>
            </div>
            <button style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon name="search" size={18} color={T.color.t70} />
            </button>
          </div>

          {/* filter chips row */}
          <div style={{ padding: '0 20px 8px', display: 'flex', gap: 6, overflowX: 'auto' }}>
            {[
              { l: '◉ people', on: true,  c: T.color.accent },
              { l: '▤ orgs',   on: true,  c: T.color.blue },
              { l: '◆ events', on: true,  c: T.color.t40 },
              { l: '◇ topics', on: false, c: T.color.violet },
              { l: '☆ warm',   on: false, c: T.color.third },
            ].map((f, i) => (
              <span key={i} style={{
                padding: '6px 11px', borderRadius: 999,
                background: f.on ? `${f.c}1f` : 'rgba(255,255,255,0.03)',
                color: f.on ? f.c : T.color.t40,
                border: `1px solid ${f.on ? f.c + '40' : 'rgba(255,255,255,0.08)'}`,
                font: `600 11px ${T.font.mono}`, letterSpacing: 0.5, textTransform: 'uppercase', whiteSpace: 'nowrap',
              }}>{f.l}</span>
            ))}
          </div>

          {/* graph canvas */}
          <div style={{ flex: 1, height: 480, position: 'relative' }}>
            <GraphCanvas />
          </div>

          {/* mini selected card */}
          <div style={{
            position: 'absolute', left: 16, right: 16, bottom: 110, zIndex: 80,
            padding: 12, borderRadius: 14,
            background: 'rgba(10,10,10,0.9)', backdropFilter: 'blur(20px)',
            border: `1px solid ${T.color.accent}40`,
            boxShadow: `0 14px 30px rgba(0,0,0,0.5), 0 0 40px rgba(255,196,82,0.1)`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar name="Sarah" size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ font: `700 14px ${T.font.sans}`, color: T.color.ink }}>Sarah Chen</span>
                  <span style={{
                    padding: '2px 6px', borderRadius: 4,
                    background: `${T.color.accent}1f`, color: T.color.accent,
                    font: `700 9px ${T.font.mono}`, letterSpacing: 0.6, textTransform: 'uppercase',
                  }}>warm</span>
                </div>
                <div style={{ font: `400 11.5px ${T.font.mono}`, color: T.color.t55, marginTop: 2 }}>Rust Lead · Acme · 5 edges</div>
              </div>
              <button style={{ width: 32, height: 32, borderRadius: '50%', background: T.color.accent, border: '1.5px solid #000', boxShadow: '2px 2px 0 #000', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="arrowR" size={14} color="#000" />
              </button>
            </div>
          </div>

          <MobileNav active="graph" />
        </div>
      </ArtCenter>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // 8. PERSON DETAIL
  // ─────────────────────────────────────────────────────────────────────
  function ScreenPerson() {
    return (
      <ArtCenter>
        <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
          <div style={{ height: '100%', overflowY: 'auto' }}>
            {/* nav row */}
            <div style={{ padding: '4px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="arrowL" size={16} color={T.color.t85} />
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Icon name="graph" size={16} color={T.color.t70} />
                </button>
                <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Icon name="settings" size={16} color={T.color.t70} />
                </button>
              </div>
            </div>

            {/* hero */}
            <div style={{ padding: '24px 24px 18px' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
                <Avatar name="Sarah" size={72} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.accent, letterSpacing: 1.5, textTransform: 'uppercase' }}>◉ person</span>
                    <span style={{ padding: '2px 7px', borderRadius: 4, background: `${T.color.accent}1f`, color: T.color.accent, font: `700 9px ${T.font.mono}`, letterSpacing: 0.5, textTransform: 'uppercase' }}>warm</span>
                  </div>
                  <div style={{ font: `800 24px/1 ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.025em' }}>Sarah Chen</div>
                  <div style={{ font: `400 13px ${T.font.mono}`, color: T.color.t55, marginTop: 4 }}>Rust Lead · Acme Corp</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                <Pill size="sm">#engineering</Pill>
                <Pill size="sm">#rust</Pill>
                <Pill size="sm" color={T.color.accent}>#follow-up</Pill>
                <Pill size="sm">#hot-reload</Pill>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button style={{ flex: 1, padding: '11px', borderRadius: 10, background: T.color.accent, color: '#000', border: '1.5px solid #000', boxShadow: '3px 3px 0 #000', font: `700 13px ${T.font.sans}`, cursor: 'pointer' }}>Draft check-in →</button>
                <button style={{ padding: '11px 13px', borderRadius: 10, background: 'transparent', color: T.color.t85, border: '1.5px solid rgba(255,255,255,0.18)', font: `600 13px ${T.font.sans}`, cursor: 'pointer' }}>edit</button>
              </div>
            </div>

            {/* stat trio */}
            <div style={{ padding: '6px 24px 0', display: 'flex', justifyContent: 'space-around' }}>
              {[
                { v: '5',  l: 'edges' },
                { v: '3',  l: 'commits' },
                { v: '7d', l: 'since' },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ font: `400 32px/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent, letterSpacing: '-0.03em' }}>{s.v}</div>
                  <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* notes */}
            <div style={{ padding: '24px 20px 0' }}>
              <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t55, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>◆ from your captures</div>
              <div style={{
                padding: 14, borderRadius: 12,
                background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.6 }}>14:32 · oct 14 · DevConnect 2026</span>
                  <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30 }}>0:42</span>
                </div>
                <div style={{ font: `400 13.5px/1.55 ${T.font.sans}`, color: T.color.t85 }}>
                  "She's <span style={{ color: T.color.accent, fontWeight: 600 }}>their rust lead</span>. Talked edge-config + hot-reloading. I said I'd send her my <span style={{ fontFamily: T.font.mono, color: T.color.accent }}>edge-reload</span> repo."
                </div>
              </div>
            </div>

            {/* follow-ups */}
            <div style={{ padding: '20px 20px 0' }}>
              <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>◆ follow-ups</div>
              <div style={{
                padding: 14, borderRadius: 12, marginBottom: 6,
                background: 'rgba(255,196,82,0.06)', border: `1px solid ${T.color.accent}40`,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${T.color.accent}`, background: T.color.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="check" size={12} color="#000" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: `600 13px ${T.font.sans}`, color: T.color.ink }}>Send github.com/me/edge-reload</div>
                  <div style={{ font: `400 11px ${T.font.mono}`, color: T.color.t40, marginTop: 2 }}>due · tomorrow · drafted</div>
                </div>
              </div>
            </div>

            {/* related */}
            <div style={{ padding: '20px 20px 130px' }}>
              <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t55, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>◆ related</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { n: 'Marcus Rivera', r: 'co-attended DevConnect', c: T.color.blue },
                  { n: 'Acme Corp',     r: 'works at',                c: T.color.blue, sq: true },
                  { n: 'Priya Sharma',  r: 'overlapping topic · diarization', c: T.color.violet },
                ].map((r, i) => (
                  <div key={i} style={{
                    padding: 12, borderRadius: 10,
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <Avatar name={r.n} size={32} square={r.sq} color={r.c} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: `600 13px ${T.font.sans}`, color: T.color.ink }}>{r.n}</div>
                      <div style={{ font: `400 11px ${T.font.mono}`, color: T.color.t40, marginTop: 1 }}>{r.r}</div>
                    </div>
                    <Icon name="arrowR" size={14} color={T.color.t40} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <MobileNav active="graph" />
        </div>
      </ArtCenter>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // 9. ACTS INBOX
  // ─────────────────────────────────────────────────────────────────────
  function ScreenActs() {
    return (
      <ArtCenter>
        <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
          <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 110 }}>
            {/* header */}
            <div style={{ padding: '4px 20px 8px' }}>
              <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>◆ acts</div>
              <div style={{ font: `800 28px/1 ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.025em' }}>
                drafts <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>awaiting you</i>.
              </div>
              <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40, marginTop: 6, letterSpacing: 0.5 }}>
                agent_drafts // 5 pending · 12 sent
              </div>
            </div>

            {/* agent stripe */}
            <div style={{ margin: '14px 20px 10px', padding: '10px 12px', borderRadius: 10,
              background: `linear-gradient(90deg, ${T.color.accent}12, transparent)`,
              border: `1px solid ${T.color.accent}30`,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.color.accent, boxShadow: `0 0 8px ${T.color.accent}`, animation: 'wm-pulse-d 1.6s infinite' }} />
              <div style={{ flex: 1, font: `500 11px ${T.font.mono}`, color: T.color.t85 }}>
                <span style={{ color: T.color.accent, fontWeight: 700 }}>wingmic</span> read your graph at 06:12 · drafted 5 actions
              </div>
            </div>

            {/* filters */}
            <div style={{ padding: '0 20px 10px', display: 'flex', gap: 6 }}>
              <span style={{ padding: '6px 11px', borderRadius: 999, background: '#fff', color: '#000', font: `700 10.5px ${T.font.mono}`, letterSpacing: 0.5, textTransform: 'uppercase', border: '1px solid #fff' }}>Pending · 5</span>
              <span style={{ padding: '6px 11px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', color: T.color.t55, font: `600 10.5px ${T.font.mono}`, letterSpacing: 0.5, textTransform: 'uppercase', border: '1px solid rgba(255,255,255,0.08)' }}>Sent · 12</span>
              <span style={{ padding: '6px 11px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', color: T.color.t55, font: `600 10.5px ${T.font.mono}`, letterSpacing: 0.5, textTransform: 'uppercase', border: '1px solid rgba(255,255,255,0.08)' }}>All</span>
            </div>

            {/* list */}
            <div style={{ padding: '4px 16px' }}>
              {/* Expanded first item */}
              <div style={{
                marginBottom: 8, borderRadius: 14,
                background: 'rgba(255,255,255,0.025)', border: `1px solid ${T.color.accent}`,
                overflow: 'hidden',
              }}>
                <div style={{ padding: 13, display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                  <Avatar name="Sarah" size={34} square color={T.color.accent} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ font: `700 9px ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.8, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, background: `${T.color.accent}18`, border: `1px solid ${T.color.accent}30` }}>↗ check-in</span>
                      <span style={{ font: `700 9px ${T.font.mono}`, color: T.color.alarm, letterSpacing: 0.8, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, background: `${T.color.alarm}18`, border: `1px solid ${T.color.alarm}30` }}>● now</span>
                    </div>
                    <div style={{ font: `600 14px ${T.font.sans}`, color: T.color.ink }}>Sarah Chen</div>
                    <div style={{ font: `400 12px/1.45 ${T.font.sans}`, color: T.color.t55, marginTop: 2 }}>7d since DevConnect — you promised her the repo.</div>
                  </div>
                  <span style={{ color: T.color.t40, fontSize: 16, fontFamily: T.font.mono }}>−</span>
                </div>
                <div style={{ padding: '0 13px 13px', borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', gap: 14, font: `500 10px ${T.font.mono}`, color: T.color.t40, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    <span>✉ email</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>conf
                      <span style={{ display: 'inline-block', width: 38, height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, position: 'relative' }}>
                        <span style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '92%', background: T.color.accent, borderRadius: 2 }} />
                      </span>
                      92%
                    </span>
                  </div>
                  <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t70, padding: '6px 0 4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    Subject: The edge-config repo I mentioned
                  </div>
                  <div style={{ font: `700 9px ${T.font.mono}`, color: T.color.t30, textTransform: 'uppercase', letterSpacing: 1, marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span>draft · email</span>
                    <span>✎ edit</span>
                  </div>
                  <div style={{
                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 8, padding: 11, marginTop: 6,
                    font: `400 11px/1.55 ${T.font.mono}`, color: T.color.t85, whiteSpace: 'pre-wrap',
                  }}>Hey Sarah — Great meeting you at DevConnect last week. As promised, here's the repo we talked about: github.com/me/edge-reload. The hot-reload bit lives in /src/watcher.

Would love your eyes on it whenever.

— M</div>
                  <div style={{ font: `400 9px ${T.font.mono}`, color: T.color.t30, marginTop: 10, letterSpacing: 0.3 }}>
                    sourced from: voice note 14:32 · follow-up: Send GitHub repo
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button style={{ flex: 1, padding: '11px', borderRadius: 10, background: T.color.accent, color: '#000', border: '1.5px solid #000', boxShadow: '3px 3px 0 #000', font: `700 13px ${T.font.sans}`, cursor: 'pointer' }}>Send now →</button>
                    <button style={{ padding: '11px 13px', borderRadius: 10, background: 'transparent', color: T.color.t70, border: '1px solid rgba(255,255,255,0.12)', font: `500 12px ${T.font.mono}`, cursor: 'pointer' }}>skip</button>
                  </div>
                </div>
              </div>

              {/* Collapsed items */}
              {[
                { name: 'Marcus Rivera', glyph: '◷', kind: 'reminder', color: T.color.blue, conf: 88, why: 'Coffee Mon · no invite sent.' },
                { name: 'Priya → Deepak', glyph: '⇌', kind: 'intro',    color: T.color.violet, conf: 74, why: 'Both work on voice + MCP.' },
                { name: 'Jordan Kim', glyph: '↗', kind: 'check-in', color: T.color.second, conf: 95, why: 'You said you\'d send self-host docs today.' },
              ].map((a, i) => (
                <div key={i} style={{
                  padding: 13, marginBottom: 8, borderRadius: 14,
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', gap: 11,
                }}>
                  <Avatar name={a.name} size={34} square color={a.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ font: `700 9px ${T.font.mono}`, color: a.color, letterSpacing: 0.8, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, background: `${a.color}18`, border: `1px solid ${a.color}30` }}>{a.glyph} {a.kind}</span>
                      <span style={{ font: `500 9px ${T.font.mono}`, color: T.color.t40 }}>· {a.conf}%</span>
                    </div>
                    <div style={{ font: `600 13.5px ${T.font.sans}`, color: T.color.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                    <div style={{ font: `400 11.5px ${T.font.sans}`, color: T.color.t55, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{a.why}</div>
                  </div>
                  <span style={{ color: T.color.t40, fontSize: 16, fontFamily: T.font.mono }}>+</span>
                </div>
              ))}
            </div>
          </div>
          <MobileNav active="acts" />
        </div>
      </ArtCenter>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // 10. SEARCH RESULTS
  // ─────────────────────────────────────────────────────────────────────
  function ScreenSearch() {
    return (
      <ArtCenter>
        <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
          <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 110 }}>
            {/* search field */}
            <div style={{ padding: '4px 16px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="arrowL" size={16} color={T.color.t85} />
              </button>
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 14px', borderRadius: 12,
                background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${T.color.accent}50`,
              }}>
                <Icon name="search" size={16} color={T.color.accent} />
                <span style={{ flex: 1, font: `400 14.5px ${T.font.sans}`, color: T.color.ink }}>
                  rust at acme<span style={{ display: 'inline-block', width: 2, height: 16, background: T.color.accent, marginLeft: 2, verticalAlign: 'text-bottom', animation: 'wm-blink 0.7s step-end infinite' }} />
                </span>
                <Icon name="x" size={14} color={T.color.t55} />
              </div>
            </div>

            {/* result-type filters */}
            <div style={{ padding: '0 16px 12px', display: 'flex', gap: 6, overflowX: 'auto' }}>
              {[
                { l: 'all · 8',     on: true },
                { l: 'people · 3',  on: false },
                { l: 'commits · 4', on: false },
                { l: 'orgs · 1',    on: false },
              ].map((f, i) => (
                <span key={i} style={{
                  padding: '5px 10px', borderRadius: 999,
                  background: f.on ? '#fff' : 'rgba(255,255,255,0.04)',
                  color: f.on ? '#000' : T.color.t55,
                  font: `600 10.5px ${T.font.mono}`, letterSpacing: 0.5, textTransform: 'uppercase',
                  border: `1px solid ${f.on ? '#fff' : 'rgba(255,255,255,0.08)'}`,
                  whiteSpace: 'nowrap',
                }}>{f.l}</span>
              ))}
            </div>

            {/* top match · person */}
            <div style={{ padding: '0 20px' }}>
              <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>◆ top match</div>
              <div style={{
                padding: 14, borderRadius: 14, marginBottom: 16,
                background: 'rgba(255,196,82,0.06)', border: `1px solid ${T.color.accent}40`,
                boxShadow: '0 0 40px rgba(255,196,82,0.08)',
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Avatar name="Sarah" size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: `700 15px ${T.font.sans}`, color: T.color.ink }}>
                      <mark style={{ background: `${T.color.accent}40`, color: T.color.ink, padding: '0 3px', borderRadius: 3 }}>Rust</mark> Lead at <mark style={{ background: `${T.color.accent}40`, color: T.color.ink, padding: '0 3px', borderRadius: 3 }}>Acme</mark>
                    </div>
                    <div style={{ font: `400 12px ${T.font.mono}`, color: T.color.t55, marginTop: 2 }}>Sarah Chen · 5 edges</div>
                  </div>
                  <Icon name="arrowR" size={16} color={T.color.t55} />
                </div>
              </div>

              {/* commit matches */}
              <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t55, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>◆ from your captures · 4</div>
              {[
                { who: 'sarah_chen',   t: '14:32 · oct 14', d: 'discussed edge-config strategies for hot reloading in Rust',  hl: ['Rust'] },
                { who: 'marcus_rivera', t: '15:10 · oct 14', d: 'curious about Rust vs SQLite at Acme — coffee Monday',       hl: ['Rust', 'Acme'] },
                { who: 'jordan_kim',   t: '09:14 · oct 18', d: 'wants self-host eval, knows their Rust eng team',             hl: ['Rust'] },
              ].map((r, i) => (
                <div key={i} style={{
                  padding: 12, marginBottom: 6, borderRadius: 12,
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ font: `600 10.5px ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.3 }}>{r.who}</span>
                    <span style={{ font: `500 9.5px ${T.font.mono}`, color: T.color.t30, letterSpacing: 0.3 }}>{r.t}</span>
                  </div>
                  <div style={{ font: `400 13px/1.5 ${T.font.sans}`, color: T.color.t85 }}>
                    {r.d.split(/\b/).map((token, ti) => (
                      r.hl.includes(token)
                        ? <mark key={ti} style={{ background: `${T.color.accent}40`, color: T.color.ink, padding: '0 3px', borderRadius: 3 }}>{token}</mark>
                        : <React.Fragment key={ti}>{token}</React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <MobileNav active="home" />
        </div>
      </ArtCenter>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // 11. SETTINGS
  // ─────────────────────────────────────────────────────────────────────
  function SettingsRow({ icon, label, value, danger, toggle, on }) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: danger ? 'rgba(255,107,107,0.1)' : 'rgba(255,196,82,0.08)',
          border: `1px solid ${danger ? T.color.alarm : T.color.accent}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={icon} size={16} color={danger ? T.color.alarm : T.color.accent} />
        </div>
        <span style={{ flex: 1, font: `500 14.5px ${T.font.sans}`, color: danger ? T.color.alarm : T.color.ink }}>{label}</span>
        {value && <span style={{ font: `500 12px ${T.font.mono}`, color: T.color.t40, letterSpacing: 0.3 }}>{value}</span>}
        {toggle ? (
          <div style={{
            width: 38, height: 22, borderRadius: 999,
            background: on ? T.color.accent : 'rgba(255,255,255,0.1)',
            border: `1px solid ${on ? T.color.accent : 'rgba(255,255,255,0.15)'}`,
            position: 'relative', transition: 'all 0.2s ease-out',
          }}>
            <div style={{
              position: 'absolute', top: 2, left: on ? 18 : 2,
              width: 16, height: 16, borderRadius: '50%',
              background: on ? '#000' : '#fff',
              transition: 'all 0.2s ease-out',
            }} />
          </div>
        ) : !value && <Icon name="arrowR" size={14} color={T.color.t40} />}
      </div>
    );
  }
  function ScreenSettings() {
    return (
      <ArtCenter>
        <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
          <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 110 }}>
            {/* header */}
            <div style={{ padding: '4px 20px 12px' }}>
              <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>◆ settings</div>
              <div style={{ font: `800 28px/1 ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.025em' }}>
                your <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>setup</i>.
              </div>
            </div>

            {/* profile card */}
            <div style={{ margin: '12px 16px', padding: 16, borderRadius: 14,
              background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <Avatar name="Morgan" size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: `700 15px ${T.font.sans}`, color: T.color.ink }}>Morgan Lee</div>
                <div style={{ font: `400 12px ${T.font.mono}`, color: T.color.t55, marginTop: 2 }}>morgan@wingmic.xyz · plan · pro</div>
              </div>
              <button style={{ padding: '8px 12px', borderRadius: 8, background: 'transparent', color: T.color.ink, border: '1px solid rgba(255,255,255,0.18)', font: `500 12px ${T.font.mono}`, cursor: 'pointer', letterSpacing: 0.3 }}>edit</button>
            </div>

            {/* sections */}
            <div style={{ padding: '12px 0 0' }}>
              <div style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', padding: '0 20px 6px' }}>◆ capture</div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, margin: '0 16px' }}>
                <SettingsRow icon="mic"        label="Microphone access"      toggle on />
                <SettingsRow icon="headphones" label="Hands-free shortcut"    value="Hold ⌘" />
                <SettingsRow icon="lock"       label="Lock after"             value="3 sec" />
                <SettingsRow icon="bolt"       label="On-device transcribe"   toggle on />
              </div>
            </div>

            <div style={{ padding: '20px 0 0' }}>
              <div style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', padding: '0 20px 6px' }}>◆ agent</div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, margin: '0 16px' }}>
                <SettingsRow icon="sparkle" label="Morning sweep" value="06:12" />
                <SettingsRow icon="bell"    label="Push when draft ready" toggle on />
                <SettingsRow icon="filter"  label="Confidence threshold"  value="70%" />
              </div>
            </div>

            <div style={{ padding: '20px 0 0' }}>
              <div style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', padding: '0 20px 6px' }}>◆ integrations</div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, margin: '0 16px' }}>
                <SettingsRow icon="send"   label="Gmail"            value="connected" />
                <SettingsRow icon="cog"    label="Google Calendar"  value="connected" />
                <SettingsRow icon="chat"   label="Slack"            value="connect →" />
              </div>
            </div>

            <div style={{ padding: '20px 0 0' }}>
              <div style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.t40, letterSpacing: 2, textTransform: 'uppercase', padding: '0 20px 6px' }}>data</div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, margin: '0 16px' }}>
                <SettingsRow icon="graph"  label="Export graph (JSON)" />
                <SettingsRow icon="trash"  label="Erase all data" danger />
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: '24px 20px 14px', font: `400 11px ${T.font.mono}`, color: T.color.t30, letterSpacing: 1, fontStyle: 'italic' }}>
              wingmic v0.1 · the social RAM you carry
            </div>
          </div>
          <MobileNav active="home" />
        </div>
      </ArtCenter>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // CAPTURE VARIANT A — CHAT-ANCHORED (canonical, matches video)
  // ─────────────────────────────────────────────────────────────────────
  function CaptureVariantA() {
    return (
      <ArtCenter>
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* sticker */}
          <div style={{
            position: 'absolute', top: 56, right: 18,
            padding: '5px 10px', borderRadius: 999, background: T.color.accent, color: '#000',
            font: `700 9.5px ${T.font.mono}`, letterSpacing: 1, textTransform: 'uppercase',
            boxShadow: '3px 3px 0 rgba(0,0,0,0.3)', transform: 'rotate(-4deg)', zIndex: 95,
          }}>variant A · default</div>

          {/* header */}
          <div style={{ padding: '4px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name="W" size={32} square color={T.color.accent} />
              <div style={{ flex: 1 }}>
                <div style={{ font: `700 14px ${T.font.sans}`, color: T.color.ink }}>wingmic</div>
                <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.alarm, letterSpacing: 0.4, marginTop: 2 }}>● recording</div>
              </div>
              <span style={{ font: `700 14px ${T.font.mono}`, color: T.color.accent }}>0:12</span>
            </div>
          </div>

          {/* dimmed thread + live transcript inline */}
          <div style={{ flex: 1, overflow: 'hidden', padding: '20px 20px 220px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <div style={{
                padding: '11px 14px', borderRadius: '18px 18px 4px 18px',
                background: T.color.accent, color: '#000',
                font: `500 14px ${T.font.sans}`,
                border: '1.5px solid #000', boxShadow: '3px 3px 0 #000', maxWidth: 260,
              }}>met sarah from acme at devconnect, she's their rust lead<span style={{ display: 'inline-block', width: 2, height: 14, background: '#000', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'wm-blink 0.7s step-end infinite' }} /></div>
            </div>
            <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40, letterSpacing: 0.4, textAlign: 'right' }}>↪ transcribing locally</div>
          </div>

          {/* composer · recording */}
          <div style={{ position: 'absolute', left: 16, right: 16, bottom: 24, zIndex: 90 }}>
            <div style={{
              padding: 10, borderRadius: 999,
              background: 'rgba(255,196,82,0.08)', border: `1.5px solid ${T.color.accent}`,
              backdropFilter: 'blur(20px)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.color.alarm, marginLeft: 8, animation: 'wm-pulse-d 1s infinite' }} />
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <VoiceBars active count={22} height={22} width={2} gap={2} color={T.color.accent} />
              </div>
              <span style={{ font: `400 12px ${T.font.sans}`, color: T.color.t55, fontStyle: 'italic' }}>← slide to cancel</span>
              <button style={{
                width: 46, height: 46, borderRadius: '50%',
                background: T.color.accent, border: '1.5px solid #000',
                boxShadow: `0 0 30px ${T.color.accent}60, 3px 3px 0 #000`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                transform: 'scale(1.05)',
              }}><Icon name="mic" size={20} color="#000" /></button>
            </div>
            {/* slide-up to lock */}
            <div style={{
              position: 'absolute', bottom: '110%', right: 14,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(255,196,82,0.12)', border: `1.5px solid ${T.color.accent}70`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'wm-drift 1.6s ease-in-out infinite',
              }}>
                <Icon name="lock" size={14} color={T.color.accent} />
              </div>
              <span style={{ font: `600 9px ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.5, textTransform: 'uppercase' }}>↑ lock</span>
            </div>
          </div>
        </div>
      </ArtCenter>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // CAPTURE VARIANT B — CENTERED ORB
  // ─────────────────────────────────────────────────────────────────────
  function CaptureVariantB() {
    return (
      <ArtCenter>
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            position: 'absolute', top: 56, right: 18,
            padding: '5px 10px', borderRadius: 999, background: T.color.third, color: '#000',
            font: `700 9.5px ${T.font.mono}`, letterSpacing: 1, textTransform: 'uppercase',
            boxShadow: '3px 3px 0 rgba(0,0,0,0.3)', transform: 'rotate(3deg)', zIndex: 95,
          }}>variant B · orb</div>

          {/* top: minimal status */}
          <div style={{ padding: '8px 20px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon name="x" size={16} color={T.color.t70} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.color.alarm, animation: 'wm-pulse-d 1s infinite' }} />
              <span style={{ font: `700 13px ${T.font.mono}`, color: T.color.alarm, letterSpacing: 0.5, textTransform: 'uppercase' }}>recording</span>
            </div>
            <span style={{ font: `700 14px ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.4 }}>0:12</span>
          </div>

          {/* centered orb + ambient rings */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <MicOrb size={180} state="recording" />
            <div style={{ marginTop: 32, textAlign: 'center' }}>
              <div style={{ font: `400 22px/1.3 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>
                say what's worth keeping.
              </div>
              <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 14 }}>
                ↪ transcribing locally · on-device
              </div>
            </div>
          </div>

          {/* floating transcript at bottom */}
          <div style={{ position: 'absolute', left: 16, right: 16, bottom: 130, zIndex: 70 }}>
            <div style={{
              padding: 14, borderRadius: 14,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(20px)',
            }}>
              <div style={{ font: `400 13.5px/1.55 ${T.font.sans}`, color: T.color.ink }}>
                met sarah from acme, rust lead. discussed edge-config for hot reloading<span style={{ display: 'inline-block', width: 2, height: 14, background: T.color.accent, marginLeft: 2, verticalAlign: 'text-bottom', animation: 'wm-blink 0.7s step-end infinite' }} />
              </div>
            </div>
          </div>

          {/* bottom: discard / send */}
          <div style={{ position: 'absolute', left: 16, right: 16, bottom: 30, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <button style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(255,107,107,0.12)', border: `1.5px solid ${T.color.alarm}50`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}><Icon name="trash" size={18} color={T.color.alarm} /></button>
            <div style={{ flex: 1, textAlign: 'center', font: `500 10px ${T.font.mono}`, color: T.color.t40, letterSpacing: 1, textTransform: 'uppercase' }}>
              hold orb · or use buttons
            </div>
            <button style={{
              width: 56, height: 56, borderRadius: '50%',
              background: T.color.accent, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}><Icon name="arrowUp" size={20} color="#000" /></button>
          </div>
        </div>
      </ArtCenter>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // CAPTURE VARIANT C — SLIDE-UP SHEET
  // ─────────────────────────────────────────────────────────────────────
  function CaptureVariantC() {
    return (
      <ArtCenter>
        <div style={{ position: 'relative', height: '100%' }}>
          {/* dim home behind */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.35,
            padding: '16px 20px',
            pointerEvents: 'none',
          }}>
            <div style={{ font: `800 26px/1 ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.02em' }}>today</div>
            <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40, marginTop: 6 }}>mon · oct 21</div>
            <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
              <div>
                <div style={{ font: `400 56px/0.85 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>12</div>
                <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40 }}>people</div>
              </div>
              <div>
                <div style={{ font: `400 56px/0.85 ${T.font.serif}`, fontStyle: 'italic', color: T.color.second }}>3</div>
                <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40 }}>acts</div>
              </div>
            </div>
          </div>

          {/* scrim */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
          }} />

          {/* sticker */}
          <div style={{
            position: 'absolute', top: 56, left: 18,
            padding: '5px 10px', borderRadius: 999, background: T.color.second, color: '#000',
            font: `700 9.5px ${T.font.mono}`, letterSpacing: 1, textTransform: 'uppercase',
            boxShadow: '3px 3px 0 rgba(0,0,0,0.3)', transform: 'rotate(-3deg)', zIndex: 95,
          }}>variant C · sheet</div>

          {/* sheet */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            background: T.color.bgRaised, border: '1px solid rgba(255,255,255,0.1)',
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: '20px 22px 30px',
            boxShadow: '0 -10px 30px rgba(0,0,0,0.6)',
            height: '64%',
          }}>
            <div style={{ width: 44, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto 18px' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div>
                <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase' }}>◆ quick capture</div>
                <div style={{ font: `800 22px ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.02em', marginTop: 4 }}>
                  who you <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>just met</i>.
                </div>
              </div>
              <span style={{ font: `700 14px ${T.font.mono}`, color: T.color.accent }}>0:12</span>
            </div>

            {/* transcript */}
            <div style={{
              marginTop: 14, padding: 14, borderRadius: 14,
              background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.color.accent}40`,
            }}>
              <div style={{ font: `400 14px/1.55 ${T.font.sans}`, color: T.color.ink }}>
                met sarah from acme, rust lead. discussed edge-config for hot reloading<span style={{ display: 'inline-block', width: 2, height: 14, background: T.color.accent, marginLeft: 2, verticalAlign: 'text-bottom', animation: 'wm-blink 0.7s step-end infinite' }} />
              </div>
              <div style={{ marginTop: 10 }}>
                <VoiceBars active count={20} height={18} width={2} gap={2} color={T.color.accent} />
              </div>
            </div>

            {/* entities being extracted */}
            <div style={{ marginTop: 14 }}>
              <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t55, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>↪ live entities</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                <EntityTag kind="person">sarah chen</EntityTag>
                <EntityTag kind="company">acme</EntityTag>
                <EntityTag kind="concept">edge-config</EntityTag>
              </div>
            </div>

            {/* discard / send big controls */}
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button style={{
                width: 50, height: 50, borderRadius: 14,
                background: 'rgba(255,107,107,0.12)', border: `1.5px solid ${T.color.alarm}50`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
              }}><Icon name="trash" size={18} color={T.color.alarm} /></button>
              <button style={{
                flex: 1, padding: '14px', borderRadius: 14,
                background: T.color.accent, color: '#000', border: '1.5px solid #000', boxShadow: '4px 4px 0 #000',
                font: `700 14.5px ${T.font.sans}`, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>Save commit <Icon name="arrowR" size={16} color="#000" /></button>
            </div>
            <div style={{ textAlign: 'center', font: `500 10px ${T.font.mono}`, color: T.color.t40, letterSpacing: 0.5, marginTop: 10, fontStyle: 'italic' }}>
              swipe down to dismiss
            </div>
          </div>
        </div>
      </ArtCenter>
    );
  }

  Object.assign(window, {
    ScreenGraph, ScreenPerson, ScreenActs, ScreenSearch, ScreenSettings,
    CaptureVariantA, CaptureVariantB, CaptureVariantC,
  });
})();
