// library/lib-entities.jsx — entity detail screens (company + event)
// Person detail already lives in lib-capture-variants. These complete the set.
(function () {
  const T = window.WMT;
  const { Pill, Avatar, EntityTag, Icon, ArtCenter, MobileNav } = window;

  // ─────────────────────────────────────────────────────────────────────
  // COMPANY DETAIL — mobile
  // ─────────────────────────────────────────────────────────────────────
  function ScreenCompany() {
    return (
      <ArtCenter>
        <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
          <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 110 }}>
            {/* Nav row */}
            <div style={{ padding: '4px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="arrowL" size={16} color={T.color.t85} />
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Icon name="graph" size={16} color={T.color.t70} />
                </button>
                <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Icon name="pin" size={16} color={T.color.t70} />
                </button>
              </div>
            </div>

            {/* Hero */}
            <div style={{ padding: '20px 24px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                {/* Company tile */}
                <div style={{
                  width: 64, height: 64, borderRadius: 14,
                  background: T.color.blue, color: '#000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  font: `900 28px ${T.font.sans}`, letterSpacing: -1,
                  boxShadow: '3px 3px 0 rgba(0,0,0,0.3)',
                }}>A</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.blue, letterSpacing: 1.5, textTransform: 'uppercase' }}>▤ company</span>
                  </div>
                  <div style={{ font: `800 24px/1 ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.025em' }}>
                    Acme <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.blue }}>Corp</i>
                  </div>
                  <div style={{ font: `400 13px ${T.font.mono}`, color: T.color.t55, marginTop: 4 }}>infra · 240 staff · sf</div>
                </div>
              </div>

              {/* Quick links */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <a style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 11px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: T.color.t85, font: `500 11.5px ${T.font.mono}`, letterSpacing: 0.3, textDecoration: 'none',
                }}>↗ acme.com</a>
                <a style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 11px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: T.color.t85, font: `500 11.5px ${T.font.mono}`, letterSpacing: 0.3, textDecoration: 'none',
                }}>↗ careers</a>
                <a style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 11px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: T.color.t85, font: `500 11.5px ${T.font.mono}`, letterSpacing: 0.3, textDecoration: 'none',
                }}>↗ blog</a>
              </div>

              {/* CTAs */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button style={{ flex: 1, padding: '11px', borderRadius: 10, background: T.color.accent, color: '#000', border: '1.5px solid #000', boxShadow: '3px 3px 0 #000', font: `700 13px ${T.font.sans}`, cursor: 'pointer' }}>Find warm path →</button>
                <button style={{ padding: '11px 13px', borderRadius: 10, background: 'transparent', color: T.color.t85, border: '1.5px solid rgba(255,255,255,0.18)', font: `600 12px ${T.font.mono}`, cursor: 'pointer', letterSpacing: 0.3 }}>draft intro</button>
              </div>
            </div>

            {/* Stat trio */}
            <div style={{ padding: '6px 24px 0', display: 'flex', justifyContent: 'space-around' }}>
              {[
                { v: '3',  l: 'you know',  c: T.color.accent },
                { v: '7',  l: 'commits',   c: T.color.second },
                { v: '5d', l: 'last touch', c: T.color.third },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ font: `400 32px/1 ${T.font.serif}`, fontStyle: 'italic', color: s.c, letterSpacing: '-0.03em' }}>{s.v}</div>
                  <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* People you know there */}
            <div style={{ padding: '24px 20px 0' }}>
              <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>◆ people you know · 3</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { n: 'Sarah Chen',  r: 'Rust Lead · last seen 7d', c: T.color.accent, warm: true },
                  { n: 'Tomás López',  r: 'Eng Manager · DM at GA',   c: T.color.second },
                  { n: 'Yuki Tanaka',  r: 'PM (intros: marcus)',      c: T.color.violet },
                ].map((p, i) => (
                  <div key={i} style={{
                    padding: 12, borderRadius: 12,
                    background: 'rgba(255,255,255,0.025)', border: `1px solid ${p.warm ? T.color.accent + '40' : 'rgba(255,255,255,0.06)'}`,
                    display: 'flex', alignItems: 'center', gap: 11,
                  }}>
                    <Avatar name={p.n} size={36} color={p.c} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
                        <span style={{ font: `700 13.5px ${T.font.sans}`, color: T.color.ink }}>{p.n}</span>
                        {p.warm && <span style={{ padding: '1px 6px', borderRadius: 4, background: `${T.color.accent}1f`, color: T.color.accent, font: `700 9px ${T.font.mono}`, letterSpacing: 0.5, textTransform: 'uppercase' }}>warm</span>}
                      </div>
                      <div style={{ font: `400 11.5px ${T.font.mono}`, color: T.color.t55, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.r}</div>
                    </div>
                    <Icon name="arrowR" size={14} color={T.color.t40} />
                  </div>
                ))}
              </div>
            </div>

            {/* Recent mentions */}
            <div style={{ padding: '22px 20px 0' }}>
              <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t55, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>◆ from your captures · 4</div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '4px 12px' }}>
                {[
                  { who: 'sarah_chen', d: 'their rust lead — edge-config',  t: 'oct 14', c: T.color.accent },
                  { who: 'marcus_riv', d: '"acme\'s sqlite story is iffy"', t: 'oct 14', c: T.color.blue },
                  { who: 'agent',      d: 'inferred · acme uses notify-rs', t: 'oct 16', c: T.color.second },
                ].map((r, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
                    borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: r.c }} />
                    <span style={{ font: `500 10.5px ${T.font.mono}`, color: r.c, minWidth: 80, letterSpacing: 0.3 }}>{r.who}</span>
                    <span style={{ flex: 1, font: `400 12px/1.4 ${T.font.sans}`, color: T.color.t70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.d}</span>
                    <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30 }}>{r.t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Topics */}
            <div style={{ padding: '20px 20px 0' }}>
              <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t55, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>◆ topics discussed</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                <EntityTag kind="concept">edge config</EntityTag>
                <EntityTag kind="concept">hot reloading</EntityTag>
                <EntityTag kind="concept">notify-rs</EntityTag>
                <EntityTag kind="concept">sqlite WAL</EntityTag>
              </div>
            </div>

            {/* Pending actions */}
            <div style={{ padding: '22px 20px 0' }}>
              <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>◆ open actions</div>
              <div style={{
                padding: 12, borderRadius: 10,
                background: 'rgba(255,196,82,0.06)', border: `1px solid ${T.color.accent}40`,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${T.color.accent}25`, border: `1px solid ${T.color.accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="send" size={14} color={T.color.accent} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: `600 12.5px ${T.font.sans}`, color: T.color.ink }}>Send edge-reload repo · Sarah</div>
                  <div style={{ font: `400 10.5px ${T.font.mono}`, color: T.color.t40, marginTop: 1 }}>via you · drafted</div>
                </div>
                <Icon name="arrowR" size={14} color={T.color.t55} />
              </div>
            </div>
          </div>
          <MobileNav active="graph" />
        </div>
      </ArtCenter>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // EVENT DETAIL — mobile
  // ─────────────────────────────────────────────────────────────────────
  function ScreenEvent() {
    return (
      <ArtCenter>
        <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
          <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 110 }}>
            {/* Nav row */}
            <div style={{ padding: '4px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="arrowL" size={16} color={T.color.t85} />
              </button>
              <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="settings" size={16} color={T.color.t70} />
              </button>
            </div>

            {/* Hero with diamond glyph */}
            <div style={{ padding: '24px 24px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{ width: 64, height: 64, position: 'relative', flexShrink: 0 }}>
                  <svg width="64" height="64" viewBox="0 0 64 64">
                    <polygon points="32,4 60,32 32,60 4,32" fill="none" stroke={T.color.t55} strokeWidth="2.5" />
                    <polygon points="32,18 46,32 32,46 18,32" fill={T.color.t40} opacity="0.5" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t55, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>◆ event</div>
                  <div style={{ font: `800 24px/1 ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.025em' }}>
                    DevConnect <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>'26</i>
                  </div>
                  <div style={{ font: `400 13px ${T.font.mono}`, color: T.color.t55, marginTop: 4 }}>oct 14 · sf · 2 days</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <Pill mono size="md">◷ 8 days ago</Pill>
                <Pill mono size="md" color={T.color.accent}>● live recap</Pill>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button style={{ flex: 1, padding: '11px', borderRadius: 10, background: T.color.accent, color: '#000', border: '1.5px solid #000', boxShadow: '3px 3px 0 #000', font: `700 13px ${T.font.sans}`, cursor: 'pointer' }}>Generate recap →</button>
                <button style={{ padding: '11px 13px', borderRadius: 10, background: 'transparent', color: T.color.t85, border: '1.5px solid rgba(255,255,255,0.18)', font: `600 12px ${T.font.mono}`, cursor: 'pointer', letterSpacing: 0.3 }}>check-ins</button>
              </div>
            </div>

            {/* Stat trio */}
            <div style={{ padding: '6px 24px 0', display: 'flex', justifyContent: 'space-around' }}>
              {[
                { v: '4', l: 'people met', c: T.color.accent },
                { v: '12', l: 'commits',    c: T.color.second },
                { v: '7', l: 'topics',     c: T.color.violet },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ font: `400 32px/1 ${T.font.serif}`, fontStyle: 'italic', color: s.c, letterSpacing: '-0.03em' }}>{s.v}</div>
                  <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* People met */}
            <div style={{ padding: '24px 20px 0' }}>
              <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>◆ people you met · 4</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { n: 'Sarah Chen',    r: 'Acme · Rust', c: T.color.accent, t: '14:32 day 1' },
                  { n: 'Marcus Rivera',  r: 'Dataweave · CTO', c: T.color.blue, t: '15:10 day 1' },
                  { n: 'Priya Sharma',   r: 'NeuralPath · ML', c: T.color.violet, t: '16:45 day 1' },
                  { n: 'Alex Novak',    r: 'Stripe · Platform', c: T.color.third, t: '11:08 day 2' },
                ].map((p, i) => (
                  <div key={i} style={{
                    padding: 12, borderRadius: 12,
                    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', gap: 11,
                  }}>
                    <Avatar name={p.n} size={36} color={p.c} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: `700 13.5px ${T.font.sans}`, color: T.color.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.n}</div>
                      <div style={{ font: `400 11.5px ${T.font.mono}`, color: T.color.t55, marginTop: 1 }}>{p.r} · {p.t}</div>
                    </div>
                    <Icon name="arrowR" size={14} color={T.color.t40} />
                  </div>
                ))}
              </div>
            </div>

            {/* Topics raised */}
            <div style={{ padding: '22px 20px 0' }}>
              <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t55, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>◆ topics raised</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                <EntityTag kind="concept">edge config</EntityTag>
                <EntityTag kind="concept">hot reloading</EntityTag>
                <EntityTag kind="concept">sqlite WAL</EntityTag>
                <EntityTag kind="concept">diarization</EntityTag>
                <EntityTag kind="concept">MCP</EntityTag>
              </div>
            </div>

            {/* Timeline */}
            <div style={{ padding: '22px 20px 0' }}>
              <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t55, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>◆ timeline</div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '4px 14px' }}>
                {[
                  { t: '09:00 d1', w: 'opening keynote', d: 'sat in row 4 with priya' },
                  { t: '14:32 d1', w: '→ sarah_chen',    d: 'rust lead at acme · 4 edges' },
                  { t: '15:10 d1', w: '→ marcus_rivera', d: 'cto at dataweave · 3 edges' },
                  { t: '16:45 d1', w: '→ priya_sharma',  d: 'voice ML · diarization paper' },
                  { t: '11:08 d2', w: '→ alex_novak',    d: 'webhook reliability' },
                ].map((r, i, arr) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                    borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}>
                    <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40, minWidth: 60, letterSpacing: 0.3 }}>{r.t}</span>
                    <span style={{ font: `600 11px ${T.font.mono}`, color: T.color.accent, minWidth: 100, letterSpacing: 0.3 }}>{r.w}</span>
                    <span style={{ flex: 1, font: `400 12px ${T.font.sans}`, color: T.color.t70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.d}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending actions from this event */}
            <div style={{ padding: '22px 20px 0' }}>
              <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>◆ acts from this event · 3</div>
              {[
                { n: 'Sarah Chen', why: 'send edge-reload repo', c: T.color.accent, k: '↗ check-in' },
                { n: 'Marcus → Priya', why: 'intro · sqlite + voice',  c: T.color.violet, k: '⇌ intro' },
                { n: 'Priya Sharma', why: 'read diarization paper', c: T.color.violet, k: '◷ remind' },
              ].map((a, i) => (
                <div key={i} style={{
                  padding: 11, marginBottom: 6, borderRadius: 10,
                  background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', gap: 11,
                }}>
                  <Avatar name={a.n} size={30} square color={a.c} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: `700 11px ${T.font.mono}`, color: a.c, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 2 }}>{a.k}</div>
                    <div style={{ font: `500 12.5px ${T.font.sans}`, color: T.color.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.n} · <span style={{ color: T.color.t55, fontWeight: 400 }}>{a.why}</span></div>
                  </div>
                  <button style={{ padding: '6px 10px', borderRadius: 7, background: T.color.accent, color: '#000', border: '1.5px solid #000', font: `700 10px ${T.font.sans}`, cursor: 'pointer' }}>send →</button>
                </div>
              ))}
            </div>
          </div>
          <MobileNav active="graph" />
        </div>
      </ArtCenter>
    );
  }

  Object.assign(window, { ScreenCompany, ScreenEvent });
})();
