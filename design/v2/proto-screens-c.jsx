// proto-screens-c.jsx — Event, Acts, Search, Settings
(function () {
  const T = window.PT;
  const { Icon, Avatar, Pill, EntityTag, VoiceBars, ActivityRow } = window;
  const { PhoneFrame, MobileNav, MobileTopBar, Eyebrow, ChromeBtn } = window;

  // ── EVENT DETAIL ─────────────────────────────────────────────────────────
  function ScreenEvent({ onNavigate }) {
    return (
      <PhoneFrame>
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', color: T.color.ink, fontFamily: T.font.sans }}>
          <div style={{ padding: '6px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => onNavigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: T.color.t55 }}>
              <Icon name="arrowL" size={18} color={T.color.t55} /> back
            </button>
            <ChromeBtn icon="settings" onClick={() => onNavigate('settings')} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 100px' }}>
            {/* Hero */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
              <div style={{ flexShrink: 0 }}>
                <svg width={64} height={64} viewBox="0 0 64 64">
                  <polygon points="32,4 60,32 32,60 4,32" fill="none" stroke={T.color.t55} strokeWidth={2.5} />
                  <polygon points="32,14 50,32 32,50 14,32" fill={T.color.t40} opacity={0.3} />
                </svg>
              </div>
              <div>
                <div style={{ font: `700 10px ${T.font.mono}`, color: T.color.t55, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>◆ event</div>
                <div style={{ font: `800 22px/1 ${T.font.sans}`, letterSpacing: '-0.025em' }}>DevConnect <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>'26</i></div>
                <div style={{ font: `400 11px ${T.font.mono}`, color: T.color.t55, marginTop: 3 }}>oct 14 · sf · 2 days</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              <span style={{ padding: '5px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', font: `600 10.5px ${T.font.mono}`, color: T.color.t55, textTransform: 'uppercase', letterSpacing: 0.5 }}>◷ 8 days ago</span>
              <span style={{ padding: '5px 10px', borderRadius: 999, background: `${T.color.accent}1f`, border: `1px solid ${T.color.accent}40`, font: `600 10.5px ${T.font.mono}`, color: T.color.accent, textTransform: 'uppercase', letterSpacing: 0.5 }}>● live recap</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button style={{ flex: 1, padding: '12px', borderRadius: 10, background: T.color.accent, color: '#000', font: `700 13px ${T.font.sans}`, border: '1.5px solid #000', boxShadow: '4px 4px 0 #000', cursor: 'pointer' }}>Generate recap →</button>
              <button style={{ padding: '12px 16px', borderRadius: 10, background: 'transparent', color: T.color.ink, font: `500 12px ${T.font.sans}`, border: '1.5px solid rgba(255,255,255,0.22)', cursor: 'pointer' }}>check-ins</button>
            </div>
            <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
              {[{ v:'4', l:'people met', c:T.color.accent }, { v:'12', l:'commits', c:T.color.second }, { v:'7', l:'topics', c:T.color.violet }].map((s,i) => (
                <div key={i}>
                  <div style={{ font: `400 32px/0.9 ${T.font.serif}`, fontStyle: 'italic', color: s.c, letterSpacing: '-0.04em' }}>{s.v}</div>
                  <div style={{ font: `500 9px ${T.font.mono}`, color: T.color.t40, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>
            <Eyebrow>people you met · 4</Eyebrow>
            {[
              { n: 'Sarah Chen',    s: 'Acme · Rust',    t: '14:32 d1' },
              { n: 'Marcus Rivera', s: 'Dataweave',       t: '15:10 d1' },
              { n: 'Priya Sharma',  s: 'NeuralPath',      t: '16:45 d1' },
              { n: 'Alex Novak',    s: 'Stripe',          t: '11:08 d2' },
            ].map((p, i) => (
              <div key={i} onClick={() => onNavigate('person')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none', cursor: 'pointer' }}>
                <Avatar name={p.n} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ font: `500 13.5px ${T.font.sans}`, color: T.color.ink }}>{p.n}</div>
                  <div style={{ font: `400 11px ${T.font.mono}`, color: T.color.t40 }}>{p.s}</div>
                </div>
                <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30 }}>{p.t}</span>
                <Icon name="arrowR" size={14} color={T.color.t40} />
              </div>
            ))}
            <div style={{ marginTop: 16 }}>
              <Eyebrow>topics raised</Eyebrow>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
                <EntityTag kind="concept">edge config</EntityTag>
                <EntityTag kind="concept">hot reloading</EntityTag>
                <EntityTag kind="concept">voice ML</EntityTag>
                <EntityTag kind="concept">sqlite WAL</EntityTag>
              </div>
              <Eyebrow>timeline</Eyebrow>
              {[
                { t: '09:00 d1', who: 'keynote', d: 'sat in row 4 with priya' },
                { t: '14:32 d1', who: 'sarah_chen', d: 'rust lead, edge-config' },
                { t: '15:10 d1', who: 'marcus_r', d: 'cto dataweave, coffee mon' },
                { t: '16:45 d1', who: 'priya_s', d: 'voice ML, speaker diarization' },
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40, minWidth: 56, flexShrink: 0 }}>{row.t}</span>
                  <span style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.accent, minWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.who}</span>
                  <span style={{ font: `400 12.5px/1.3 ${T.font.sans}`, color: T.color.t70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.d}</span>
                </div>
              ))}
            </div>
          </div>
          <MobileNav active="graph" onNavigate={onNavigate} />
        </div>
      </PhoneFrame>
    );
  }

  // ── ACTS INBOX ───────────────────────────────────────────────────────────
  function ScreenActs({ onNavigate }) {
    const [expanded, setExpanded] = React.useState(0);
    const [filter, setFilter] = React.useState('pending');
    const acts = [
      { kind: '↗ check-in', name: 'Sarah Chen',    why: '7d since DevConnect — you promised her the repo.',  conf: 92, color: T.color.accent, ch: 'email', overdue: true,
        draft: 'Hey Sarah — Great meeting you at DevConnect last week. As promised, here\'s the edge-config hot-reload repo: github.com/me/edge-reload. Would love your thoughts on the notify-rs integration.' },
      { kind: '◷ reminder', name: 'Marcus Rivera',  why: 'Coffee Mon · no invite sent yet.',                   conf: 88, color: T.color.blue,   ch: 'calendar' },
      { kind: '⇌ intro',    name: 'Priya → Deepak', why: 'Both work on voice + MCP pipelines.',               conf: 74, color: T.color.violet, ch: 'email' },
      { kind: '↗ check-in', name: 'Jordan Kim',     why: 'You said you\'d send self-host eval guide.',         conf: 95, color: T.color.second, ch: 'email' },
    ];
    return (
      <PhoneFrame>
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', color: T.color.ink, fontFamily: T.font.sans }}>
          <div style={{ padding: '8px 20px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <Eyebrow>acts</Eyebrow>
            <div style={{ font: `800 24px/1 ${T.font.sans}`, letterSpacing: '-0.025em' }}>drafts <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>awaiting you</i></div>
            <div style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.t40, marginTop: 4 }}>agent_drafts // 5 pending · 12 sent</div>
            <div style={{ margin: '10px 0 8px', padding: '10px 12px', borderRadius: 10, background: 'linear-gradient(90deg,rgba(255,196,82,0.08),transparent)', border: `1px solid ${T.color.accent}20`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.color.accent, animation: 'wm-pulse-d 1.6s infinite' }} />
              <span style={{ font: `500 11px ${T.font.mono}`, color: T.color.t70 }}><span style={{ color: T.color.accent }}>wingmic</span> read your graph 06:12 · drafted 5 actions</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[{ k: 'pending', l: 'Pending · 5' }, { k: 'sent', l: 'Sent · 12' }, { k: 'all', l: 'All' }].map(f => (
                <button key={f.k} onClick={() => setFilter(f.k)} style={{ padding: '5px 12px', borderRadius: 999, cursor: 'pointer', background: filter === f.k ? '#fff' : 'rgba(255,255,255,0.04)', color: filter === f.k ? '#000' : T.color.t55, border: `1px solid ${filter === f.k ? '#fff' : 'rgba(255,255,255,0.08)'}`, font: `600 11px ${T.font.mono}`, letterSpacing: 0.5, textTransform: 'uppercase' }}>{f.l}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 90px' }}>
            {acts.map((a, i) => {
              const isExp = expanded === i;
              return (
                <div key={i} style={{ marginBottom: 8, borderRadius: 14, background: 'rgba(255,255,255,0.025)', border: isExp ? `1px solid ${a.color}` : '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div onClick={() => setExpanded(isExp ? -1 : i)} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <Avatar name={a.name} size={isExp ? 36 : 30} square color={a.color} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ font: `700 10px ${T.font.mono}`, color: a.color, letterSpacing: 0.5, textTransform: 'uppercase' }}>{a.kind}</span>
                        {a.overdue && <span style={{ padding: '1px 6px', borderRadius: 999, background: `${T.color.alarm}18`, color: T.color.alarm, border: `1px solid ${T.color.alarm}30`, font: `600 9px ${T.font.mono}`, textTransform: 'uppercase' }}>● now</span>}
                        <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.t40 }}>· {a.conf}%</span>
                      </div>
                      <div style={{ font: `600 13.5px ${T.font.sans}`, color: T.color.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                      <div style={{ font: `400 11.5px/1.35 ${T.font.sans}`, color: T.color.t55, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.why}</div>
                    </div>
                    <Icon name={isExp ? 'x' : 'plus'} size={16} color={T.color.t40} />
                  </div>
                  {isExp && a.draft && (
                    <div style={{ padding: '0 14px 14px' }}>
                      <div style={{ borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: 12, marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ font: `600 10px ${T.font.mono}`, color: T.color.t55, textTransform: 'uppercase', letterSpacing: 0.5 }}>✉ email · conf ▆▆▆▆ {a.conf}%</span>
                          <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.accent, cursor: 'pointer' }}>✎ edit</span>
                        </div>
                        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', font: `400 11.5px/1.55 ${T.font.mono}`, color: T.color.t85, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{a.draft}</div>
                        <div style={{ font: `500 9.5px ${T.font.mono}`, color: T.color.t30, marginTop: 6 }}>sourced from: voice note 14:32 · 3 commits</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button style={{ flex: 1, padding: '12px', borderRadius: 10, background: T.color.accent, color: '#000', font: `700 13px ${T.font.sans}`, border: '1.5px solid #000', boxShadow: '4px 4px 0 #000', cursor: 'pointer' }}>Send now →</button>
                        <button style={{ padding: '12px 16px', borderRadius: 10, background: 'transparent', color: T.color.t55, font: `500 12px ${T.font.mono}`, border: '1.5px solid rgba(255,255,255,0.22)', cursor: 'pointer' }}>skip</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <MobileNav active="acts" onNavigate={onNavigate} />
        </div>
      </PhoneFrame>
    );
  }

  // ── SEARCH ───────────────────────────────────────────────────────────────
  function ScreenSearch({ onNavigate }) {
    const [filter, setFilter] = React.useState('all');
    const highlight = (text, term) => {
      const parts = text.split(new RegExp(`(${term})`, 'gi'));
      return parts.map((p, i) => p.toLowerCase() === term.toLowerCase()
        ? <mark key={i} style={{ background: `${T.color.accent}40`, color: T.color.ink, padding: '0 2px', borderRadius: 3 }}>{p}</mark>
        : p);
    };
    return (
      <PhoneFrame>
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', color: T.color.ink, fontFamily: T.font.sans }}>
          <div style={{ padding: '8px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => onNavigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                <Icon name="arrowL" size={18} color={T.color.t55} />
              </button>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${T.color.accent}50` }}>
                <Icon name="search" size={16} color={T.color.accent} />
                <span style={{ flex: 1, font: `400 14.5px ${T.font.sans}`, color: T.color.ink }}>rust at acme<span style={{ display: 'inline-block', width: 2, height: 16, background: T.color.accent, marginLeft: 2, verticalAlign: 'text-bottom', animation: 'wm-blink 0.7s step-end infinite' }} /></span>
                <span style={{ font: `500 12px ${T.font.sans}`, color: T.color.t40, cursor: 'pointer' }}>×</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {[{ k:'all',l:'all · 8'}, { k:'people',l:'people · 3'}, { k:'commits',l:'commits · 4'}, { k:'orgs',l:'orgs · 1'}].map(f => (
                <button key={f.k} onClick={() => setFilter(f.k)} style={{ padding: '4px 10px', borderRadius: 999, cursor: 'pointer', background: filter === f.k ? '#fff' : 'rgba(255,255,255,0.04)', color: filter === f.k ? '#000' : T.color.t55, border: `1px solid ${filter === f.k ? '#fff' : 'rgba(255,255,255,0.08)'}`, font: `600 10px ${T.font.mono}`, letterSpacing: 0.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{f.l}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 30px' }}>
            <Eyebrow>top match</Eyebrow>
            <div onClick={() => onNavigate('person')} style={{ padding: 14, borderRadius: 14, background: 'rgba(255,196,82,0.06)', border: `1px solid ${T.color.accent}40`, boxShadow: `0 0 40px rgba(255,196,82,0.08)`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <Avatar name="Sarah" size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ font: `700 14.5px ${T.font.sans}`, color: T.color.ink }}>{highlight('Sarah Chen · Rust Lead at Acme', 'rust')}</div>
                <div style={{ font: `400 11.5px ${T.font.mono}`, color: T.color.t55, marginTop: 2 }}>Sarah Chen · 5 edges · {highlight('Acme', 'acme')}</div>
              </div>
              <Icon name="arrowR" size={14} color={T.color.t55} />
            </div>
            <Eyebrow>from your captures · 4</Eyebrow>
            {[
              { who: 'sarah_chen',   t: '14:32 · oct 14', d: `discussed edge-config for hot reloading in Rust` },
              { who: 'marcus_r',     t: '15:10 · oct 14', d: `curious about Rust vs SQLite at Acme — coffee Monday` },
              { who: 'jordan_kim',   t: '09:14 · oct 18', d: `wants self-host eval, knows their Rust eng team` },
            ].map((r, i) => (
              <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }} onClick={() => onNavigate('chat-response')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ font: `600 11px ${T.font.mono}`, color: T.color.accent }}>{r.who}</span>
                  <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30 }}>{r.t}</span>
                </div>
                <div style={{ font: `400 13px/1.5 ${T.font.sans}`, color: T.color.t85 }}>{highlight(r.d, 'rust')}</div>
              </div>
            ))}
          </div>
        </div>
      </PhoneFrame>
    );
  }

  // ── SETTINGS ─────────────────────────────────────────────────────────────
  function ScreenSettings({ onNavigate }) {
    const [toggles, setToggles] = React.useState({ mic: true, hands: false, ondev: true, sweep: true, push: false });
    const toggle = k => setToggles(p => ({ ...p, [k]: !p[k] }));
    function Toggle({ on, onClick }) {
      return (
        <div onClick={onClick} style={{ width: 38, height: 22, borderRadius: 999, background: on ? T.color.accent : 'rgba(255,255,255,0.15)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: 3, left: on ? 19 : 3, width: 16, height: 16, borderRadius: '50%', background: on ? '#000' : '#fff', transition: 'left 0.2s' }} />
        </div>
      );
    }
    function SettingsRow({ icon, label, value, tKey, danger }) {
      const c = danger ? T.color.alarm : T.color.accent;
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: danger ? 'rgba(255,107,107,0.12)' : 'rgba(255,196,82,0.08)', border: `1px solid ${c}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name={icon} size={15} color={c} />
          </div>
          <span style={{ flex: 1, font: `500 14px ${T.font.sans}`, color: danger ? T.color.alarm : T.color.ink }}>{label}</span>
          {tKey ? <Toggle on={toggles[tKey]} onClick={() => toggle(tKey)} /> : <span style={{ font: `500 12px ${T.font.mono}`, color: T.color.t40, letterSpacing: 0.3 }}>{value}</span>}
          {!tKey && <Icon name="arrowR" size={14} color={T.color.t30} />}
        </div>
      );
    }
    function Section({ title, children }) {
      return (
        <div style={{ marginBottom: 16 }}>
          <div style={{ font: `500 10.5px ${T.font.mono}`, color: title === 'data' ? T.color.t40 : T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 }}>◆ {title}</div>
          <div style={{ borderRadius: 14, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            {children}
          </div>
        </div>
      );
    }
    return (
      <PhoneFrame>
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', color: T.color.ink, fontFamily: T.font.sans }}>
          <div style={{ padding: '8px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <Eyebrow>settings</Eyebrow>
            <div style={{ font: `800 24px/1 ${T.font.sans}`, letterSpacing: '-0.025em' }}>your <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>setup</i></div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 100px' }}>
            {/* Profile */}
            <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Avatar name="Morgan" size={48} color={T.color.third} />
              <div style={{ flex: 1 }}>
                <div style={{ font: `700 15px ${T.font.sans}`, color: T.color.ink }}>Morgan Lee</div>
                <div style={{ font: `400 11.5px ${T.font.mono}`, color: T.color.t40 }}>morgan@wingmic.xyz · pro</div>
              </div>
              <button style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', color: T.color.t70, font: `500 11.5px ${T.font.sans}`, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>edit</button>
            </div>
            <Section title="capture">
              <SettingsRow icon="mic"       label="Microphone access"      tKey="mic" />
              <SettingsRow icon="headphones" label="Hands-free shortcut"   value="Hold ⌘" />
              <SettingsRow icon="lock"      label="Lock after"             value="3 sec" />
              <SettingsRow icon="bolt"      label="On-device transcribe"   tKey="ondev" />
            </Section>
            <Section title="agent">
              <SettingsRow icon="sparkle"   label="Morning sweep"          value="06:12" />
              <SettingsRow icon="bell"      label="Push when draft ready"  tKey="push" />
              <SettingsRow icon="filter"    label="Confidence threshold"   value="70%" />
            </Section>
            <Section title="integrations">
              <SettingsRow icon="mail"      label="Gmail"                  value="connected" />
              <SettingsRow icon="calendar"  label="Google Calendar"        value="connected" />
              <SettingsRow icon="chat"      label="Slack"                  value="connect →" />
            </Section>
            <Section title="data">
              <SettingsRow icon="export"    label="Export graph (JSON)"    value="" />
              <SettingsRow icon="trash"     label="Erase all data"         danger value="" />
            </Section>
            <div style={{ textAlign: 'center', font: `400 11px ${T.font.mono}`, color: T.color.t30, fontStyle: 'italic', marginTop: 8 }}>wingmic v0.1 · the social RAM you carry</div>
          </div>
          <MobileNav active="home" onNavigate={onNavigate} />
        </div>
      </PhoneFrame>
    );
  }

  Object.assign(window, { ScreenEvent, ScreenActs, ScreenSearch, ScreenSettings });
})();
