// library/lib-states.jsx — loading, empty, modal, toast
(function () {
  const T = window.WMT;
  const { ArtboardFrame, ABTitle, MicroLabel, Pill, Avatar, EntityTag, Icon } = window;

  // helper: skeleton bar
  function Skel({ w = '100%', h = 12, r = 4, style }) {
    return (
      <div style={{
        width: w, height: h, borderRadius: r,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 100%)',
        backgroundSize: '200% 100%',
        animation: 'wm-shimmer 1.6s linear infinite',
        ...style,
      }} />
    );
  }

  function StatesLoading() {
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="04.1 / loading" title="Skeletons match " italic="real shape." lead="Never spinners alone. Mirror the destination layout: card silhouettes, avatar circles, line lengths." />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          {/* Person card skeleton */}
          <div>
            <MicroLabel style={{ marginBottom: 10 }}>person card</MicroLabel>
            <div style={{ padding: 16, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Skel w={44} h={44} r={22} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Skel w="60%" h={13} />
                  <Skel w="40%" h={10} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
                <Skel w={62} h={18} r={999} />
                <Skel w={48} h={18} r={999} />
                <Skel w={70} h={18} r={999} />
              </div>
            </div>
          </div>

          {/* Chat msg skeleton */}
          <div>
            <MicroLabel style={{ marginBottom: 10 }}>chat — thinking</MicroLabel>
            <div style={{ display: 'flex', gap: 10 }}>
              <Avatar name="W" size={32} square color={T.color.accent} />
              <div style={{ flex: 1, padding: '12px 14px', borderRadius: '4px 14px 14px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: '50%', background: T.color.accent,
                      animation: `wm-pulse-d 1.4s ease-in-out ${i * 0.18}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            </div>
            <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40, marginTop: 14, marginLeft: 42, letterSpacing: 0.4 }}>
              ↪ reading graph · 1.4k nodes
            </div>
          </div>

          {/* Graph skeleton */}
          <div>
            <MicroLabel style={{ marginBottom: 10 }}>graph — settling</MicroLabel>
            <div style={{ height: 142, position: 'relative', borderRadius: 14, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <svg viewBox="0 0 200 140" style={{ width: '100%', height: '100%' }}>
                {[[60,30],[140,40],[160,90],[100,110],[40,100],[110,55]].map(([x,y], i) => (
                  <line key={i} x1={100} y1={70} x2={x} y2={y} stroke="rgba(255,196,82,0.2)" strokeWidth="1" />
                ))}
                <circle cx="100" cy="70" r="9" fill={T.color.accent} opacity="0.45">
                  <animate attributeName="r" values="8;11;8" dur="1.6s" repeatCount="indefinite" />
                </circle>
                {[[60,30,T.color.accent],[140,40,T.color.second],[160,90,T.color.violet],[100,110,T.color.blue],[40,100,T.color.third],[110,55,T.color.accent]].map(([x,y,c], i) => (
                  <circle key={i} cx={x} cy={y} r="5" fill={c} opacity="0.5">
                    <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.6s" begin={`${i*0.12}s`} repeatCount="indefinite" />
                  </circle>
                ))}
              </svg>
            </div>
          </div>

          {/* Inline loading bar */}
          <div>
            <MicroLabel style={{ marginBottom: 10 }}>inline progress</MicroLabel>
            <div style={{ padding: 16, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }}>
              <div style={{ font: `500 12px ${T.font.mono}`, color: T.color.accent, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                → extracting entities
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: '64%', background: T.color.accent,
                  borderRadius: 2,
                  animation: 'wm-shimmer 1.6s linear infinite',
                  backgroundImage: `linear-gradient(90deg, ${T.color.accent} 0%, #fff 50%, ${T.color.accent} 100%)`,
                  backgroundSize: '200% 100%',
                }} />
              </div>
              <div style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.t40, marginTop: 8, letterSpacing: 0.4 }}>
                3 of 5 · sarah_chen · acme_corp · edge_config
              </div>
            </div>
          </div>

          {/* Spinner button */}
          <div>
            <MicroLabel style={{ marginBottom: 10 }}>button · sending</MicroLabel>
            <div style={{ padding: 16, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <button style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '12px 22px', borderRadius: 10, background: T.color.accent, color: '#000',
                font: `700 14px ${T.font.sans}`, border: '1.5px solid #000', boxShadow: '4px 4px 0 #000', cursor: 'wait',
              }}>
                <span style={{
                  width: 14, height: 14, borderRadius: '50%',
                  border: '2px solid rgba(0,0,0,0.25)', borderTopColor: '#000',
                  animation: 'wm-spin 0.8s linear infinite',
                }} /> Sending…
              </button>
            </div>
          </div>

          {/* List skeleton */}
          <div>
            <MicroLabel style={{ marginBottom: 10 }}>list · activity</MicroLabel>
            <div style={{ padding: 12, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }}>
                  <Skel w={6} h={6} r={3} />
                  <Skel w={70} h={9} />
                  <Skel w={50} h={9} />
                  <Skel w="40%" h={9} />
                  <div style={{ flex: 1 }} />
                  <Skel w={30} h={9} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // EMPTY STATES
  // ─────────────────────────────────────────────────────────────────────
  function EmptyCard({ glyph, title, italic, body, action, style }) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1.5px dashed rgba(255,255,255,0.12)',
        borderRadius: 18, padding: 28,
        display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start',
        ...style,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'rgba(255,196,82,0.08)', border: `1px solid ${T.color.accent}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          font: `500 26px ${T.font.mono}`, color: T.color.accent,
        }}>{glyph}</div>
        <div>
          <div style={{ font: `800 22px ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.02em' }}>
            {title} {italic && <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>{italic}</i>}
          </div>
          <div style={{ font: `400 14px/1.5 ${T.font.sans}`, color: T.color.t55, marginTop: 8, maxWidth: 320 }}>{body}</div>
        </div>
        {action}
      </div>
    );
  }
  function StatesEmpty() {
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="04.2 / empty" title="An invitation, " italic="not a wall." lead="Every empty state earns a glyph, a one-line italic twist, and a single nudge action." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <EmptyCard
            glyph="◉"
            title="No contacts" italic="yet."
            body="Hold the mic and talk about who you met. We'll do the parsing."
            action={
              <button style={{ padding: '10px 16px', borderRadius: 10, background: T.color.accent, color: '#000', border: '1.5px solid #000', boxShadow: '3px 3px 0 #000', font: `700 13px ${T.font.sans}`, cursor: 'pointer' }}>
                Start first capture →
              </button>
            }
          />
          <EmptyCard
            glyph="◷"
            title="Inbox" italic="clear."
            body="The agent will pin drafts here when something needs you. Check back at 6:12am."
            action={<span style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40, letterSpacing: 0.5 }}>↪ next sweep · 06:12</span>}
          />
          <EmptyCard
            glyph="◇"
            title="No matches" italic="for that."
            body={<>Try lowercase, or a different shape — <span style={{ color: T.color.accent, fontFamily: T.font.mono }}>"rust at acme"</span>.</>}
            action={
              <button style={{ padding: '10px 14px', borderRadius: 10, background: 'transparent', color: T.color.ink, border: '1.5px solid rgba(255,255,255,0.22)', font: `600 13px ${T.font.sans}`, cursor: 'pointer' }}>
                Clear filters
              </button>
            }
          />
        </div>
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // MODAL + SHEET
  // ─────────────────────────────────────────────────────────────────────
  function StatesModal() {
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="04.3 / modal + sheet" title="Two anchors. " italic="One scrim." lead="Modal centers on desktop. Sheet rises from bottom on mobile (default). Both use the same dim layer." />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {/* Modal centered */}
          <div>
            <MicroLabel style={{ marginBottom: 10 }}>modal · centered · desktop</MicroLabel>
            <div style={{
              height: 380, borderRadius: 18, overflow: 'hidden', position: 'relative',
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18,
            }}>
              <div style={{
                width: '100%', maxWidth: 340,
                background: T.color.bgRaised, border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 18, padding: 22,
                boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, background: 'rgba(255,107,107,0.12)', border: `1px solid ${T.color.alarm}50`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}><Icon name="trash" size={18} color={T.color.alarm} /></div>
                  <button style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><Icon name="x" size={18} color={T.color.t55} /></button>
                </div>
                <div style={{ font: `800 22px ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.02em' }}>
                  Discard recording?
                </div>
                <div style={{ font: `400 14px/1.5 ${T.font.sans}`, color: T.color.t55, marginTop: 8 }}>
                  This will erase the 0:42 capture and any extracted commits. Can't undo.
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                  <button style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'transparent', color: T.color.ink, border: '1.5px solid rgba(255,255,255,0.22)', font: `600 13px ${T.font.sans}`, cursor: 'pointer' }}>Keep</button>
                  <button style={{ flex: 1, padding: '11px', borderRadius: 10, background: T.color.alarm, color: '#000', border: '1.5px solid #000', boxShadow: '3px 3px 0 #000', font: `700 13px ${T.font.sans}`, cursor: 'pointer' }}>Discard</button>
                </div>
              </div>
            </div>
          </div>

          {/* Sheet bottom */}
          <div>
            <MicroLabel style={{ marginBottom: 10 }}>sheet · bottom · mobile</MicroLabel>
            <div style={{
              height: 380, borderRadius: 18, overflow: 'hidden', position: 'relative',
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)',
            }}>
              <div style={{
                position: 'absolute', left: 0, right: 0, bottom: 0,
                background: T.color.bgRaised, border: '1px solid rgba(255,255,255,0.1)',
                borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22,
                boxShadow: '0 -10px 30px rgba(0,0,0,0.5)',
              }}>
                <div style={{ width: 44, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '0 auto 16px' }} />
                <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>◆ commit extracted</div>
                <div style={{ font: `800 20px ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.02em' }}>
                  Sarah Chen — Rust Lead @ Acme
                </div>
                <div style={{ font: `400 13.5px/1.5 ${T.font.sans}`, color: T.color.t55, marginTop: 8 }}>
                  Met at DevConnect. You promised to send your edge-reload repo.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  <EntityTag kind="person">sarah chen</EntityTag>
                  <EntityTag kind="company">acme</EntityTag>
                  <EntityTag kind="concept">edge config</EntityTag>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                  <button style={{ flex: 1, padding: '12px', borderRadius: 10, background: T.color.accent, color: '#000', border: '1.5px solid #000', boxShadow: '3px 3px 0 #000', font: `700 14px ${T.font.sans}`, cursor: 'pointer' }}>Save commit</button>
                  <button style={{ padding: '12px 14px', borderRadius: 10, background: 'transparent', color: T.color.t70, border: '1.5px solid rgba(255,255,255,0.18)', font: `600 13px ${T.font.sans}`, cursor: 'pointer' }}>Edit</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 22 }}>
          {/* Dropdown menu */}
          <div>
            <MicroLabel style={{ marginBottom: 10 }}>menu · contextual</MicroLabel>
            <div style={{
              background: T.color.bgRaised, border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, padding: 6, width: 220,
              boxShadow: '0 14px 30px rgba(0,0,0,0.5)',
            }}>
              {[
                { i: 'eye', l: 'Open in graph' },
                { i: 'tag', l: 'Add tag' },
                { i: 'send', l: 'Share commit' },
                { i: 'trash', l: 'Delete', danger: true },
              ].map(it => (
                <div key={it.l} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 10px', borderRadius: 8,
                  color: it.danger ? T.color.alarm : T.color.t85,
                  font: `500 13px ${T.font.sans}`, cursor: 'pointer',
                }}>
                  <Icon name={it.i} size={16} color={it.danger ? T.color.alarm : T.color.t70} />
                  {it.l}
                </div>
              ))}
            </div>
          </div>

          {/* Tooltip */}
          <div>
            <MicroLabel style={{ marginBottom: 10 }}>tooltip · annotation</MicroLabel>
            <div style={{ position: 'relative', padding: '32px 0', width: 280 }}>
              <span style={{ font: `500 14px ${T.font.sans}`, color: T.color.t85, borderBottom: '1px dashed rgba(255,196,82,0.5)', paddingBottom: 2 }}>confidence · 92%</span>
              <div style={{
                position: 'absolute', top: 70, left: 0,
                padding: '8px 11px', borderRadius: 8,
                background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)',
                font: `500 11.5px/1.5 ${T.font.mono}`, color: T.color.t85, letterSpacing: 0.2,
                boxShadow: '0 8px 22px rgba(0,0,0,0.45)',
                maxWidth: 240,
              }}>
                grounded in 3 sources · 2 explicit asks · 0 contradictions.
                <div style={{ position: 'absolute', top: -5, left: 30, width: 10, height: 10, transform: 'rotate(45deg)', background: '#0a0a0a', borderLeft: '1px solid rgba(255,255,255,0.1)', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
            </div>
          </div>
        </div>
      </ArtboardFrame>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // TOASTS
  // ─────────────────────────────────────────────────────────────────────
  function Toast({ kind = 'success', children, mono = true, sub }) {
    const k = {
      success: { c: T.color.second, ic: 'check', bg: 'rgba(134,239,172,0.08)' },
      info:    { c: T.color.accent, ic: 'sparkle', bg: 'rgba(255,196,82,0.08)' },
      error:   { c: T.color.alarm,  ic: 'x',     bg: 'rgba(255,107,107,0.08)' },
    }[kind];
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderRadius: 12,
        background: '#0a0a0a', border: `1px solid ${k.c}40`,
        boxShadow: '0 14px 30px rgba(0,0,0,0.5)',
        minWidth: 320,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: k.bg, border: `1px solid ${k.c}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon name={k.ic} size={16} color={k.c} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: `${mono ? '600' : '600'} 12.5px ${mono ? T.font.mono : T.font.sans}`, color: k.c, letterSpacing: mono ? 0.4 : 0 }}>{children}</div>
          {sub && <div style={{ font: `400 11.5px ${T.font.mono}`, color: T.color.t55, marginTop: 2, letterSpacing: 0.3 }}>{sub}</div>}
        </div>
        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <Icon name="x" size={16} color={T.color.t40} />
        </button>
      </div>
    );
  }

  function StatesToast() {
    return (
      <ArtboardFrame padding={36}>
        <ABTitle eyebrow="04.4 / toast" title="A whisper. " italic="Then gone." lead="3 levels: success / info / error. Mono copy. 4s auto-dismiss. Tap to keep." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
          <Toast kind="success" sub="↪ saved to graph · 4 edges">→ commit · sarah_chen</Toast>
          <Toast kind="info"    sub="agent · 92% confidence · sent to sarah">↗ check-in drafted</Toast>
          <Toast kind="error"   sub="microphone permission denied">x couldn't record</Toast>
        </div>
        <div style={{ marginTop: 26 }}>
          <MicroLabel style={{ marginBottom: 10 }}>inline commit toast — slides up from bottom</MicroLabel>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 14,
            padding: '12px 16px 12px 14px', borderRadius: 999,
            background: '#0a0a0a', border: `1px solid ${T.color.accent}50`,
            boxShadow: '0 14px 30px rgba(0,0,0,0.5)',
            minWidth: 380,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.color.accent, animation: 'wm-pulse-d 1.5s infinite' }} />
            <span style={{ font: `600 12px ${T.font.mono}`, color: T.color.accent, letterSpacing: 0.5 }}>→ commit</span>
            <span style={{ font: `400 13.5px ${T.font.sans}`, color: T.color.t85 }}>sarah chen · acme · 3 edges</span>
            <span style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40, marginLeft: 'auto' }}>undo</span>
          </div>
        </div>
      </ArtboardFrame>
    );
  }

  Object.assign(window, { StatesLoading, StatesEmpty, StatesModal, StatesToast, Toast, Skel });
})();
