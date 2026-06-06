// proto-layout.jsx — PhoneFrame, MobileNav, ChatHeader, MobileTopBar, DesktopFrame, Sidebar
(function () {
  const T = window.PT;
  const { Icon, Avatar } = window;

  // ── PhoneFrame ───────────────────────────────────────────────────────────
  function PhoneFrame({ children }) {
    return (
      <div style={{ width: 409, height: 868, flexShrink: 0, borderRadius: 56, padding: 8, background: '#1a1a20', boxShadow: '0 30px 60px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.04)' }}>
        <div style={{
          width: 393, height: 852, borderRadius: 48, overflow: 'hidden', position: 'relative',
          background: T.color.bg,
          backgroundImage: 'radial-gradient(ellipse at 18% 0%, rgba(255,196,82,0.05) 0%, transparent 55%), radial-gradient(ellipse at 82% 100%, rgba(255,107,107,0.035) 0%, transparent 55%)',
        }}>
          {/* Dynamic island */}
          <div style={{ position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)', width: 126, height: 36, borderRadius: 999, background: '#000', zIndex: 200, pointerEvents: 'none' }} />
          {/* Status bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 54, zIndex: 190, pointerEvents: 'none',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 28px',
            font: `600 14.5px/1 ${T.font.sans}`, color: '#fff',
          }}>
            <span>9:41</span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
              <span style={{ letterSpacing: 1 }}>●●●</span>
              <span style={{ fontFamily: T.font.mono, fontSize: 10 }}>5G</span>
              <span style={{ display: 'inline-block', width: 22, height: 11, border: '1.4px solid #fff', borderRadius: 3, padding: 1 }}>
                <span style={{ display: 'block', width: '85%', height: '100%', background: '#fff', borderRadius: 1 }} />
              </span>
            </span>
          </div>
          {/* Content below status bar */}
          <div style={{ position: 'absolute', inset: 0, paddingTop: 54 }}>{children}</div>
          {/* Home indicator */}
          <div style={{ position: 'absolute', bottom: 9, left: '50%', transform: 'translateX(-50%)', width: 134, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.45)', zIndex: 200, pointerEvents: 'none' }} />
        </div>
      </div>
    );
  }

  // ── MobileNav ────────────────────────────────────────────────────────────
  function MobileNav({ active = 'home', onNavigate }) {
    const items = [
      { k: 'home',  icon: 'home',  label: 'home' },
      { k: 'chat',  icon: 'chat',  label: 'chat' },
      { k: 'mic',   icon: 'mic',   label: 'capture', big: true },
      { k: 'graph', icon: 'graph', label: 'graph' },
      { k: 'acts',  icon: 'acts',  label: 'acts' },
    ];
    return (
      <div style={{
        position: 'absolute', left: 16, right: 16, bottom: 22, zIndex: 80,
        background: 'rgba(10,10,10,0.78)', backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 22, padding: '8px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {items.map(it => {
          const isActive = active === it.k;
          if (it.big) return (
            <div key={it.k} style={{ position: 'relative', top: -16 }}>
              <button onClick={() => onNavigate && onNavigate('chat-recording')} style={{
                width: 52, height: 52, borderRadius: '50%',
                background: T.color.accent, border: '1.5px solid #000', boxShadow: '3px 3px 0 #000',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}><Icon name="mic" size={22} color="#000" /></button>
            </div>
          );
          return (
            <button key={it.k} onClick={() => onNavigate && onNavigate(it.k)} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '4px 6px', flex: 1, color: isActive ? T.color.accent : T.color.t40,
            }}>
              <Icon name={it.icon} size={20} color={isActive ? T.color.accent : T.color.t55} />
              <span style={{ font: `600 9px/1 ${T.font.mono}`, letterSpacing: 0.5, textTransform: 'uppercase' }}>{it.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // ── ChatHeader ───────────────────────────────────────────────────────────
  function ChatHeader({ status = 'idle', onNavigate }) {
    return (
      <div style={{
        padding: '4px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar name="W" size={36} square color={T.color.accent} />
          <div>
            <div style={{ font: `700 15px ${T.font.sans}`, color: T.color.ink }}>wingmic</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: status === 'recording' ? T.color.accent : T.color.second, animation: 'wm-pulse-d 1.6s infinite' }} />
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
          <button onClick={() => onNavigate && onNavigate('graph')} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon name="graph" size={16} color={T.color.t70} />
          </button>
          <button onClick={() => onNavigate && onNavigate('settings')} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon name="settings" size={16} color={T.color.t70} />
          </button>
        </div>
      </div>
    );
  }

  // ── MobileTopBar ────────────────────────────────────────────────────────
  function MobileTopBar({ title, italic, sub, right, onBack }) {
    return (
      <div style={{ padding: '8px 20px 12px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {onBack && (
            <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.color.t55, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, padding: 0 }}>
              <Icon name="arrowL" size={16} color={T.color.t55} />
            </button>
          )}
          <div style={{ font: `800 26px/1 ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.02em' }}>
            {title}{italic && <> <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic', color: T.color.accent }}>{italic}</i></>}
          </div>
          {sub && <div style={{ font: `500 11px ${T.font.mono}`, color: T.color.t40, letterSpacing: 1.2, marginTop: 6, textTransform: 'uppercase' }}>{sub}</div>}
        </div>
        {right}
      </div>
    );
  }

  // ── Eyebrow ─────────────────────────────────────────────────────────────
  function Eyebrow({ children, color }) {
    return (
      <div style={{ font: `500 11px ${T.font.mono}`, color: color || T.color.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
        ◆ {children}
      </div>
    );
  }

  // ── Chrome button ────────────────────────────────────────────────────────
  function ChromeBtn({ icon, onClick }) {
    return (
      <button onClick={onClick} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <Icon name={icon} size={16} color={T.color.t70} />
      </button>
    );
  }

  // ── Sidebar (desktop) ────────────────────────────────────────────────────
  function Sidebar({ active = 'home', onNavigate }) {
    const items = [
      { k: 'desktop-home',   icon: 'home',   label: 'home',   badge: null },
      { k: 'desktop-chat',   icon: 'chat',   label: 'chat',   badge: null },
      { k: 'desktop-graph',  icon: 'graph',  label: 'graph',  badge: null },
      { k: 'desktop-acts',   icon: 'acts',   label: 'acts',   badge: '5' },
      { k: 'desktop-search', icon: 'search', label: 'search', badge: null },
    ];
    return (
      <div style={{ width: 248, borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.015)', padding: '22px 14px 18px', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100%' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: T.color.bgCard, border: `1px solid ${T.color.accent}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="mic" size={16} color={T.color.accent} />
          </div>
          <span style={{ font: `800 15px ${T.font.sans}`, color: T.color.ink, letterSpacing: '-0.02em' }}>wingmic<span style={{ color: T.color.accent }}>.xyz</span></span>
        </div>
        {/* Capture CTA */}
        <button style={{
          width: '100%', padding: '11px 14px', borderRadius: 10, marginBottom: 20,
          background: T.color.accent, color: '#000', border: '1.5px solid #000', boxShadow: '4px 4px 0 #000',
          font: `700 13px ${T.font.sans}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>Hold to capture</span>
          <span style={{ font: `500 10px ${T.font.mono}`, background: 'rgba(0,0,0,0.15)', padding: '2px 6px', borderRadius: 4 }}>⌘ K</span>
        </button>
        {/* Nav */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map(it => {
            const isActive = active === it.k;
            return (
              <button key={it.k} onClick={() => onNavigate && onNavigate(it.k)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: isActive ? 'rgba(255,196,82,0.08)' : 'transparent',
                border: isActive ? '1px solid rgba(255,196,82,0.3)' : '1px solid transparent',
                color: isActive ? T.color.accent : T.color.t55,
              }}>
                <Icon name={it.icon} size={18} color={isActive ? T.color.accent : T.color.t55} />
                <span style={{ flex: 1, font: `500 13.5px ${T.font.sans}`, letterSpacing: -0.1 }}>{it.label}</span>
                {it.badge && <span style={{ font: `600 9.5px ${T.font.mono}`, color: T.color.accent, background: 'rgba(255,196,82,0.12)', padding: '2px 7px', borderRadius: 999, letterSpacing: 0.5 }}>{it.k === 'desktop-acts' ? 'acts · ' + it.badge : it.badge}</span>}
              </button>
            );
          })}
        </div>
        {/* Pinned */}
        <div style={{ marginTop: 24 }}>
          <div style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>◆ pinned · 3</div>
          {[
            { n: 'Sarah Chen', s: 'Acme Corp' },
            { n: 'Marcus Rivera', s: 'Dataweave' },
            { n: 'Priya Sharma', s: 'NeuralPath' },
          ].map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', cursor: 'pointer' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: [T.color.accent, T.color.blue, T.color.violet][i], display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 11px ${T.font.sans}`, color: '#000', flexShrink: 0 }}>{p.n[0]}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: `500 12.5px ${T.font.sans}`, color: T.color.t85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.n}</div>
                <div style={{ font: `400 10.5px ${T.font.mono}`, color: T.color.t40 }}>{p.s}</div>
              </div>
            </div>
          ))}
        </div>
        {/* Profile footer */}
        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.color.third, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `700 12px ${T.font.sans}`, color: '#000', flexShrink: 0 }}>M</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: `500 13px ${T.font.sans}`, color: T.color.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Morgan Lee</div>
            <div style={{ font: `400 10px ${T.font.mono}`, color: T.color.t30 }}>pro · 1,247 nodes</div>
          </div>
          <Icon name="settings" size={16} color={T.color.t40} />
        </div>
      </div>
    );
  }

  // ── DesktopFrame ─────────────────────────────────────────────────────────
  function DesktopFrame({ children }) {
    return (
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 30px 60px rgba(0,0,0,0.5)', background: T.color.bg, width: '100%' }}>
        {/* Title bar */}
        <div style={{ height: 40, background: '#1a1a1f', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8, flexShrink: 0 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f56' }} />
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e' }} />
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#27ca3f' }} />
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <div style={{ padding: '3px 14px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', font: `400 11.5px ${T.font.mono}`, color: T.color.t55, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.color.second }} />
              wingmic.xyz/app
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', height: 'calc(100% - 40px)' }}>{children}</div>
      </div>
    );
  }

  Object.assign(window, { PhoneFrame, MobileNav, ChatHeader, MobileTopBar, Eyebrow, ChromeBtn, Sidebar, DesktopFrame });
})();
