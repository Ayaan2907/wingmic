// proto-tokens.jsx — Design tokens + shared primitives
// Exports to window.PT (proto tokens)

(function () {
  const T = {
    color: {
      bg: '#0a0a0a', bgCard: '#08080d', bgRaised: '#0e0e12',
      ink: '#f4f1ea', inkPure: '#ffffff',
      accent: '#FFC452', second: '#86efac', third: '#FF8FAB',
      alarm: '#FF6B6B', blue: '#7DD3FC', violet: '#A78BFA',
      surf1: 'rgba(255,255,255,0.025)', surf2: 'rgba(255,255,255,0.04)', surf3: 'rgba(255,255,255,0.06)',
      bs: 'rgba(255,255,255,0.06)', bm: 'rgba(255,255,255,0.10)', bh: 'rgba(255,255,255,0.15)',
      t100: '#ffffff', t85: 'rgba(255,255,255,0.85)', t70: 'rgba(255,255,255,0.70)',
      t55: 'rgba(255,255,255,0.55)', t40: 'rgba(255,255,255,0.40)', t30: 'rgba(255,255,255,0.30)',
    },
    font: {
      sans: "'Inter', system-ui, -apple-system, sans-serif",
      mono: "'JetBrains Mono', ui-monospace, monospace",
      serif: "'Instrument Serif', Georgia, serif",
    },
  };
  window.PT = T;

  // ── Icon ────────────────────────────────────────────────────────────────
  function Icon({ name, size = 22, color = 'currentColor', style }) {
    const paths = {
      mic:      <><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3M9 21h6"/></>,
      send:     <path d="M3 11l18-7-7 18-3-7-8-4z"/>,
      search:   <><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/></>,
      graph:    <><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M7.7 7.4l3.1 8M16.4 7.4l-3.2 8"/></>,
      home:     <path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-7h-6v7H5a1 1 0 01-1-1v-9z"/>,
      acts:     <><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></>,
      person:   <><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></>,
      chat:     <path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H9l-4 4V6z"/>,
      check:    <path d="M5 12l4 4 10-10"/>,
      x:        <path d="M6 6l12 12M6 18L18 6"/>,
      lock:     <><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></>,
      arrowUp:  <path d="M12 4v16M5 11l7-7 7 7"/>,
      arrowR:   <path d="M4 12h16M13 5l7 7-7 7"/>,
      arrowL:   <path d="M20 12H4M11 5l-7 7 7 7"/>,
      trash:    <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></>,
      bell:     <><path d="M6 16V11a6 6 0 0112 0v5l2 2H4l2-2z"/><path d="M10 20a2 2 0 004 0"/></>,
      settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06A2 2 0 117.03 4.3l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06A2 2 0 1120.7 7l-.06.06A1.65 1.65 0 0020.3 9a1.65 1.65 0 001.51 1H22a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></>,
      sparkle:  <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3zM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/>,
      plus:     <path d="M12 5v14M5 12h14"/>,
      pin:      <path d="M12 2l2 6h6l-5 4 2 7-7-4-7 4 2-7-5-4h6z"/>,
      tag:      <><path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="8" cy="8" r="1.5"/></>,
      cog:      <><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></>,
      edit:     <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>,
      mail:     <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></>,
      calendar: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
      export:   <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>,
    };
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>
        {paths[name] || paths.sparkle}
      </svg>
    );
  }

  // ── Avatar ──────────────────────────────────────────────────────────────
  function Avatar({ name = '?', color, size = 36, square = false, style }) {
    const initial = (name || '?').trim()[0]?.toUpperCase() || '?';
    const palette = [T.color.accent, T.color.second, T.color.third, T.color.blue, T.color.violet];
    const c = color || palette[(initial.charCodeAt(0) - 65) % palette.length] || T.color.accent;
    return (
      <div style={{
        width: size, height: size,
        borderRadius: square ? Math.round(size * 0.28) : '50%',
        background: c, color: '#000',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        font: `800 ${Math.round(size * 0.4)}px ${T.font.sans}`,
        flexShrink: 0, ...style,
      }}>{initial}</div>
    );
  }

  // ── Pill ────────────────────────────────────────────────────────────────
  function Pill({ children, color, mono = false, size = 'md', style }) {
    const tone = color || 'rgba(255,255,255,0.6)';
    const bg = color ? `${color}1f` : 'rgba(255,255,255,0.06)';
    const bd = color ? `${color}40` : 'rgba(255,255,255,0.08)';
    const sizes = { sm: { pad: '2px 7px', fs: 10 }, md: { pad: '3px 9px', fs: 10.5 }, lg: { pad: '5px 11px', fs: 11.5 } }[size] || { pad: '3px 9px', fs: 10.5 };
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: sizes.pad, borderRadius: 999,
        background: bg, color: tone, border: `1px solid ${bd}`,
        font: `${mono ? 700 : 600} ${sizes.fs}px ${mono ? T.font.mono : T.font.sans}`,
        letterSpacing: mono ? 1 : 0.2, textTransform: mono ? 'uppercase' : 'none',
        whiteSpace: 'nowrap', ...style,
      }}>{children}</span>
    );
  }

  // ── EntityTag ───────────────────────────────────────────────────────────
  function EntityTag({ kind = 'person', children, style }) {
    const map = {
      person:  { c: T.color.accent,  glyph: '◉' },
      company: { c: T.color.blue,    glyph: '▤' },
      concept: { c: T.color.violet,  glyph: '◇' },
      event:   { c: T.color.t40,     glyph: '◆' },
      place:   { c: T.color.second,  glyph: '◍' },
    }[kind] || { c: T.color.accent, glyph: '◉' };
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 9px', borderRadius: 999,
        background: `${map.c}1f`, color: map.c, border: `1px solid ${map.c}40`,
        font: `700 10.5px ${T.font.mono}`, letterSpacing: 1, textTransform: 'uppercase',
        whiteSpace: 'nowrap', ...style,
      }}>
        <span style={{ fontSize: 9, opacity: 0.8 }}>{map.glyph}</span>
        {children}
      </span>
    );
  }

  // ── VoiceBars ───────────────────────────────────────────────────────────
  function VoiceBars({ active = false, color, count = 24, height = 38, width = 3, gap = 3, style }) {
    const c = color || T.color.accent;
    const [phase, setPhase] = React.useState(0);
    React.useEffect(() => {
      if (!active) return;
      let raf;
      const tick = () => { setPhase(performance.now() / 1000); raf = requestAnimationFrame(tick); };
      tick();
      return () => cancelAnimationFrame(raf);
    }, [active]);
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap, height, ...style }}>
        {Array.from({ length: count }, (_, i) => {
          const seed = (Math.sin(phase * 5 + i * 0.7) + Math.cos(phase * 2.6 + i * 1.1)) * 0.5 + 0.5;
          const h = active ? Math.max(4, 4 + seed * (height - 6)) : 4;
          return (
            <div key={i} style={{
              width, height: h, borderRadius: 2,
              background: active ? c : 'rgba(255,255,255,0.2)',
              transition: 'height 0.12s ease-out',
            }} />
          );
        })}
      </div>
    );
  }

  // ── MicOrb ──────────────────────────────────────────────────────────────
  function MicOrb({ size = 88, state = 'idle', icon = 'mic' }) {
    const isActive = state === 'recording' || state === 'locked';
    const orbBg = isActive || state === 'sending' || state === 'done' ? T.color.accent : 'rgba(255,255,255,0.06)';
    const orbBorder = isActive ? T.color.accent : (state === 'hover' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)');
    const iconColor = isActive || state === 'sending' || state === 'done' ? '#000' : T.color.t70;
    return (
      <div style={{ position: 'relative', width: size + 60, height: size + 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {state !== 'idle' && (
          <div style={{
            position: 'absolute', width: size + 60, height: size + 60, borderRadius: '50%',
            background: `radial-gradient(circle, ${T.color.accent}25 0%, transparent 65%)`,
          }} />
        )}
        {isActive && [0, 1, 2].map(i => (
          <div key={i} style={{
            position: 'absolute',
            width: size + i * 20, height: size + i * 20,
            borderRadius: '50%', border: `1.5px solid ${T.color.accent}`,
            opacity: Math.max(0, 0.55 - i * 0.18),
            animation: `wm-pulse-s ${1.4 + i * 0.3}s ease-in-out infinite`,
          }} />
        ))}
        <div style={{
          width: size, height: size, borderRadius: '50%',
          background: orbBg, border: `2px solid ${orbBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isActive ? `0 0 60px ${T.color.accent}50` : 'none',
          transition: 'all 0.25s ease-out', position: 'relative', zIndex: 2,
        }}>
          {state === 'thinking' ? (
            <div style={{ display: 'flex', gap: 6 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: '#000', animation: `wm-pulse-d 1.4s ease-in-out ${i * 0.18}s infinite` }} />
              ))}
            </div>
          ) : (
            <Icon name={icon} size={size * 0.35} color={iconColor} />
          )}
        </div>
      </div>
    );
  }

  // ── Sticker ─────────────────────────────────────────────────────────────
  function Sticker({ children, color, rotate = -3 }) {
    return (
      <span style={{
        display: 'inline-block', transform: `rotate(${rotate}deg)`,
        padding: '5px 10px', borderRadius: 999,
        background: color || T.color.accent, color: '#000',
        font: `700 10px ${T.font.mono}`, letterSpacing: 1, textTransform: 'uppercase',
        boxShadow: '3px 3px 0 rgba(0,0,0,0.25)', whiteSpace: 'nowrap',
      }}>{children}</span>
    );
  }

  // ── ActivityRow ─────────────────────────────────────────────────────────
  function ActivityRow({ who, what, detail, time, color, last = false }) {
    const c = color || T.color.accent;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
        borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.05)',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, animation: 'wm-pulse-d 1.6s ease-in-out infinite', flexShrink: 0 }} />
        <span style={{ font: `500 10.5px ${T.font.mono}`, color: c, minWidth: 76, letterSpacing: 0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{who}</span>
        <span style={{ font: `500 10.5px ${T.font.mono}`, color: T.color.t40, minWidth: 56, letterSpacing: 0.3 }}>{what}</span>
        <span style={{ flex: 1, font: `400 12.5px/1.3 ${T.font.sans}`, color: T.color.t70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</span>
        <span style={{ font: `500 10px ${T.font.mono}`, color: T.color.t30, letterSpacing: 0.3 }}>{time}</span>
      </div>
    );
  }

  Object.assign(window, { PT: T, Icon, Avatar, Pill, EntityTag, VoiceBars, MicOrb, Sticker, ActivityRow });
})();
