// library/lib-shared.jsx
// Shared primitives + the visual style used by every artboard.
// Loaded FIRST. Exports to window.

(function () {
  // ── tokens (mirror of design-system.md) ─────────────────────────────────
  const T = {
    color: {
      bg: '#0a0a0a',
      bgCard: '#08080d',
      bgRaised: '#0e0e12',
      ink: '#f4f1ea',
      inkPure: '#ffffff',
      accent: '#FFC452',
      second: '#86efac',
      third:  '#FF8FAB',
      alarm:  '#FF6B6B',
      blue:   '#7DD3FC',
      violet: '#A78BFA',
      surf1:  'rgba(255,255,255,0.025)',
      surf2:  'rgba(255,255,255,0.04)',
      surf3:  'rgba(255,255,255,0.06)',
      bs:     'rgba(255,255,255,0.06)',
      bm:     'rgba(255,255,255,0.10)',
      bh:     'rgba(255,255,255,0.15)',
      t100:   '#ffffff',
      t85:    'rgba(255,255,255,0.85)',
      t70:    'rgba(255,255,255,0.70)',
      t55:    'rgba(255,255,255,0.55)',
      t40:    'rgba(255,255,255,0.40)',
      t30:    'rgba(255,255,255,0.30)',
    },
    font: {
      sans:  "'Inter', system-ui, -apple-system, sans-serif",
      mono:  "'JetBrains Mono', ui-monospace, monospace",
      serif: "'Instrument Serif', Georgia, serif",
    },
    r:    { sm: 6, md: 10, lg: 14, xl: 18, pill: 999 },
    pad:  { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40 },
  };
  window.WMT = T;

  // ── artboard scaffolding ────────────────────────────────────────────────
  // Every artboard sits on the warm dark page background w/ the radial.
  const artboardBg = {
    position: 'absolute', inset: 0,
    background: T.color.bg,
    backgroundImage:
      'radial-gradient(ellipse at 18% 0%, rgba(255,196,82,0.05) 0%, transparent 55%),' +
      'radial-gradient(ellipse at 82% 100%, rgba(255,107,107,0.035) 0%, transparent 55%)',
  };

  function ArtboardFrame({ children, padding = 32, scrollY, style }) {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: scrollY ? 'auto' : 'hidden' }}>
        <div style={artboardBg} />
        <div style={{
          position: 'relative', minHeight: '100%',
          padding, color: T.color.ink, fontFamily: T.font.sans,
          ...style,
        }}>{children}</div>
      </div>
    );
  }

  // ── editorial heading w/ italic-serif twist ────────────────────────────
  function ABTitle({ eyebrow, title, italic, lead, color = T.color.accent, style }) {
    return (
      <div style={{ marginBottom: 28, ...style }}>
        {eyebrow && (
          <div style={{
            font: `500 11px/1 ${T.font.mono}`, color: T.color.accent,
            textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
            <span>◆ {eyebrow}</span>
          </div>
        )}
        {title && (
          <h2 style={{
            margin: 0, font: `800 38px/1 ${T.font.sans}`,
            letterSpacing: '-0.025em', color: T.color.inkPure,
          }}>
            {title}{italic && <> <i style={{ font: `400 1em/1 ${T.font.serif}`, fontStyle: 'italic', color }}>{italic}</i></>}.
          </h2>
        )}
        {lead && (
          <p style={{ margin: '14px 0 0', maxWidth: 580, color: T.color.t55, fontSize: 16, lineHeight: 1.55 }}>
            {lead}
          </p>
        )}
      </div>
    );
  }

  // ── micro mono label for annotations + sub-sections ─────────────────────
  function MicroLabel({ children, color = T.color.t40, style }) {
    return (
      <div style={{
        font: `500 10px/1 ${T.font.mono}`,
        color, textTransform: 'uppercase', letterSpacing: 1.5,
        ...style,
      }}>{children}</div>
    );
  }

  // ── annotation token tag (e.g. --accent  #FFC452) ───────────────────────
  function TokenTag({ name, value, color = T.color.t40 }) {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '4px 8px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 6,
        font: `500 10.5px/1 ${T.font.mono}`,
        color, letterSpacing: 0.3,
      }}>
        <span style={{ color: T.color.accent }}>{name}</span>
        {value && <span style={{ color: T.color.t55 }}>{value}</span>}
      </div>
    );
  }

  // ── phone bezel for screen artboards ─────────────────────────────────────
  // 393 × 852 (iPhone 15 Pro). 8px bezel; inner content scrolls.
  function PhoneFrame({ children, status = true, scale = 1, style }) {
    const W = 393, H = 852;
    return (
      <div style={{
        width: W * scale + 16, height: H * scale + 16,
        position: 'relative',
        ...style,
      }}>
        <div style={{
          width: W * scale + 16, height: H * scale + 16,
          borderRadius: 56 * scale, padding: 8,
          background: '#1a1a20',
          boxShadow: '0 30px 60px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.04)',
        }}>
          <div style={{
            width: W * scale, height: H * scale,
            borderRadius: 48 * scale, overflow: 'hidden', position: 'relative',
            background: T.color.bg,
            backgroundImage:
              'radial-gradient(ellipse at 18% 0%, rgba(255,196,82,0.05) 0%, transparent 55%),' +
              'radial-gradient(ellipse at 82% 100%, rgba(255,107,107,0.035) 0%, transparent 55%)',
            transform: scale === 1 ? 'none' : `scale(${scale})`,
            transformOrigin: 'top left',
          }}>
            {/* Dynamic island */}
            <div style={{
              position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
              width: 126, height: 36, borderRadius: 999,
              background: '#000',
              zIndex: 100, pointerEvents: 'none',
            }} />
            {status && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 54,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0 28px',
                font: `600 14.5px/1 ${T.font.sans}`, color: '#fff',
                zIndex: 90, pointerEvents: 'none',
              }}>
                <span>9:41</span>
                <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
                  <span>●●●●</span>
                  <span style={{ fontFamily: T.font.mono, fontSize: 10 }}>5G</span>
                  <span style={{ display: 'inline-block', width: 22, height: 11, border: '1.4px solid #fff', borderRadius: 3, padding: 1 }}>
                    <span style={{ display: 'block', width: '85%', height: '100%', background: '#fff', borderRadius: 1 }} />
                  </span>
                </span>
              </div>
            )}
            {/* Content area starts below status */}
            <div style={{ position: 'absolute', inset: 0, paddingTop: 54 }}>
              {children}
            </div>
            {/* Home indicator */}
            <div style={{
              position: 'absolute', bottom: 9, left: '50%', transform: 'translateX(-50%)',
              width: 134, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.45)',
              zIndex: 100, pointerEvents: 'none',
            }} />
          </div>
        </div>
      </div>
    );
  }

  // ── Mini buttons used across atoms ─────────────────────────────────────
  function PrimaryBtn({ children, size = 'md', style, ...rest }) {
    const sizes = {
      sm: { pad: '8px 14px', fs: 12.5 },
      md: { pad: '13px 22px', fs: 14.5 },
      lg: { pad: '15px 26px', fs: 15 },
    }[size];
    return (
      <button style={{
        padding: sizes.pad, borderRadius: 10,
        background: T.color.accent, color: '#000',
        font: `700 ${sizes.fs}px ${T.font.sans}`,
        border: '1.5px solid #000',
        boxShadow: '4px 4px 0 #000',
        cursor: 'pointer', whiteSpace: 'nowrap',
        ...style,
      }} {...rest}>{children}</button>
    );
  }
  function GhostBtn({ children, size = 'md', style, ...rest }) {
    const sizes = {
      sm: { pad: '8px 14px', fs: 12.5 },
      md: { pad: '13px 22px', fs: 14.5 },
      lg: { pad: '15px 26px', fs: 15 },
    }[size];
    return (
      <button style={{
        padding: sizes.pad, borderRadius: 10,
        background: 'transparent', color: '#fff',
        font: `600 ${sizes.fs}px ${T.font.sans}`,
        border: '1.5px solid rgba(255,255,255,0.22)',
        cursor: 'pointer', whiteSpace: 'nowrap',
        ...style,
      }} {...rest}>{children}</button>
    );
  }

  // ── Pill ────────────────────────────────────────────────────────────────
  function Pill({ children, color, mono = false, size = 'md', style }) {
    const c = color || T.color.t70;
    const tone = color ? color : 'rgba(255,255,255,0.6)';
    const bg = color ? `${color}1f` : 'rgba(255,255,255,0.06)';
    const bd = color ? `${color}40` : 'rgba(255,255,255,0.08)';
    const sizes = { sm: { pad: '2px 7px', fs: 10 }, md: { pad: '3px 9px', fs: 10.5 }, lg: { pad: '5px 11px', fs: 11.5 } }[size];
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: sizes.pad, borderRadius: 999,
        background: bg, color: tone, border: `1px solid ${bd}`,
        font: `${mono ? 700 : 600} ${sizes.fs}px ${mono ? T.font.mono : T.font.sans}`,
        letterSpacing: mono ? 1 : 0.2, textTransform: mono ? 'uppercase' : 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}>{children}</span>
    );
  }

  // ── Avatar (initial chip) ───────────────────────────────────────────────
  function Avatar({ name = '?', color, size = 36, square = false, style }) {
    const initial = name.trim()[0]?.toUpperCase() || '?';
    const palette = [T.color.accent, T.color.second, T.color.third, T.color.blue, T.color.violet];
    const c = color || palette[(initial.charCodeAt(0) - 65) % palette.length] || T.color.accent;
    return (
      <div style={{
        width: size, height: size,
        borderRadius: square ? Math.round(size * 0.28) : '50%',
        background: c, color: '#000',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        font: `800 ${Math.round(size * 0.4)}px ${T.font.sans}`,
        flexShrink: 0,
        ...style,
      }}>{initial}</div>
    );
  }

  // ── Tag pill for entity types ───────────────────────────────────────────
  function EntityTag({ kind = 'person', children, style }) {
    const map = {
      person:  { c: T.color.accent, glyph: '◉' },
      company: { c: T.color.blue,   glyph: '▤' },
      concept: { c: T.color.violet, glyph: '◇' },
      event:   { c: T.color.t40,    glyph: '◆' },
      place:   { c: T.color.second, glyph: '◍' },
    }[kind] || { c: T.color.accent, glyph: '◉' };
    return (
      <Pill color={map.c} mono size="md" style={style}>
        <span style={{ fontSize: 9, opacity: 0.8 }}>{map.glyph}</span>
        {children}
      </Pill>
    );
  }

  // ── Voice bars (deterministic — phase-driven, not random per frame) ────
  function VoiceBars({ active = false, color = T.color.accent, count = 24, height = 38, width = 3, gap = 3, style }) {
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
          const h = active ? Math.max(4, 4 + seed * (height - 6)) : 4 + (Math.sin(i * 0.5) + 1) * 2;
          return (
            <div key={i} style={{
              width, height: h, borderRadius: 2,
              background: active ? color : 'rgba(255,255,255,0.2)',
              transition: 'height 0.12s ease-out',
            }} />
          );
        })}
      </div>
    );
  }

  // ── Sticker ─────────────────────────────────────────────────────────────
  function Sticker({ children, color, rotate = -3, size = 'md', style }) {
    const c = color || T.color.accent;
    const sizes = { sm: { pad: '4px 9px', fs: 10 }, md: { pad: '6px 11px', fs: 11 }, lg: { pad: '9px 14px', fs: 13 } }[size];
    return (
      <span style={{
        display: 'inline-block', transform: `rotate(${rotate}deg)`,
        padding: sizes.pad, borderRadius: 999,
        background: c, color: '#000',
        font: `700 ${sizes.fs}px ${T.font.mono}`,
        letterSpacing: 1, textTransform: 'uppercase',
        boxShadow: '3px 3px 0 rgba(0,0,0,0.25)', whiteSpace: 'nowrap',
        ...style,
      }}>{children}</span>
    );
  }

  // ── Scribble (SVG underline) ────────────────────────────────────────────
  function Scribble({ children, color = T.color.accent, style }) {
    return (
      <span style={{ position: 'relative', display: 'inline-block', ...style }}>
        {children}
        <svg viewBox="0 0 200 12" preserveAspectRatio="none"
             style={{ position: 'absolute', left: 0, right: 0, bottom: -6, width: '100%', height: 10, overflow: 'visible' }}>
          <path d="M2 8 Q 50 2, 100 6 T 198 5" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
        </svg>
      </span>
    );
  }

  // ── Activity row (timestamp ticker) ─────────────────────────────────────
  function ActivityRow({ who, what, detail, time, color = T.color.accent, dot = true, style }) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        ...style,
      }}>
        {dot && (
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: color,
            animation: 'wm-pulse-d 1.6s ease-in-out infinite',
            flexShrink: 0,
          }} />
        )}
        <span style={{ font: `500 11px/1 ${T.font.mono}`, color, minWidth: 88, letterSpacing: 0.3 }}>{who}</span>
        <span style={{ font: `500 11px/1 ${T.font.mono}`, color: T.color.t40, minWidth: 78, letterSpacing: 0.3 }}>{what}</span>
        <span style={{ flex: 1, font: `400 13.5px/1.3 ${T.font.sans}`, color: T.color.t70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</span>
        <span style={{ font: `500 10.5px/1 ${T.font.mono}`, color: T.color.t30, letterSpacing: 0.3 }}>{time}</span>
      </div>
    );
  }

  // ── Stat block ──────────────────────────────────────────────────────────
  function Stat({ value, label, sub, color = T.color.accent, rotate = 0, style }) {
    return (
      <div style={{ transform: `rotate(${rotate}deg)`, ...style }}>
        <div style={{
          font: `400 84px/0.85 ${T.font.serif}`, fontStyle: 'italic',
          color, letterSpacing: '-0.04em',
        }}>{value}</div>
        <div style={{
          font: `500 11px/1 ${T.font.mono}`, color: T.color.t40,
          textTransform: 'uppercase', letterSpacing: 1.8, marginTop: 8,
        }}>{label}</div>
        {sub && (
          <div style={{ font: `400 13px/1.4 ${T.font.sans}`, color: T.color.t55, marginTop: 6 }}>{sub}</div>
        )}
      </div>
    );
  }

  // ── Logo block ──────────────────────────────────────────────────────────
  function Wordmark({ size = 16, accentDot = true, style }) {
    return (
      <span style={{
        font: `800 ${size}px ${T.font.sans}`,
        letterSpacing: '-0.02em', color: T.color.ink,
        ...style,
      }}>
        wingmic{accentDot && <span style={{ color: T.color.accent }}>.xyz</span>}
      </span>
    );
  }

  // ── outline icon factory ────────────────────────────────────────────────
  function Icon({ name, size = 22, color = 'currentColor', style }) {
    const paths = {
      mic:      <><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3M9 21h6"/></>,
      send:     <><path d="M3 11l18-7-7 18-3-7-8-4z"/></>,
      search:   <><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/></>,
      graph:    <><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M7.7 7.4l3.1 8M16.4 7.4l-3.2 8"/></>,
      home:     <><path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-7h-6v7H5a1 1 0 01-1-1v-9z"/></>,
      acts:     <><path d="M4 5h16v14H4z"/><path d="M4 9h16M9 5v14"/></>,
      person:   <><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></>,
      chat:     <><path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H9l-4 4V6z"/></>,
      check:    <><path d="M5 12l4 4 10-10"/></>,
      x:        <><path d="M6 6l12 12M6 18L18 6"/></>,
      lock:     <><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></>,
      arrowUp:  <><path d="M12 4v16M5 11l7-7 7 7"/></>,
      arrowR:   <><path d="M4 12h16M13 5l7 7-7 7"/></>,
      arrowL:   <><path d="M20 12H4M11 5l-7 7 7 7"/></>,
      trash:    <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></>,
      bell:     <><path d="M6 16V11a6 6 0 0112 0v5l2 2H4l2-2zM10 20a2 2 0 004 0"/></>,
      settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 005.5 15a1.65 1.65 0 00-1.51-1H4a2 2 0 110-4h.09A1.65 1.65 0 005.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06A2 2 0 118.03 4.3l.06.06a1.65 1.65 0 001.82.33H10a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06A2 2 0 1120.7 7l-.06.06A1.65 1.65 0 0020.3 9z"/></>,
      sparkle:  <><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/></>,
      bolt:     <><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></>,
      tag:      <><path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="8" cy="8" r="1.5"/></>,
      headphones: <><path d="M4 14v-2a8 8 0 0116 0v2"/><rect x="3" y="14" width="5" height="6" rx="1.5"/><rect x="16" y="14" width="5" height="6" rx="1.5"/></>,
      eye:      <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
      cog:      <><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></>,
      plus:     <><path d="M12 5v14M5 12h14"/></>,
      filter:   <><path d="M4 5h16l-6 8v6l-4-2v-4z"/></>,
      pin:      <><path d="M12 2l2 6h6l-5 4 2 7-7-4-7 4 2-7-5-4h6z" fill="none"/></>,
    };
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
           stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>
        {paths[name] || paths.sparkle}
      </svg>
    );
  }

  Object.assign(window, {
    WMT: T,
    ArtboardFrame, ABTitle, MicroLabel, TokenTag,
    PhoneFrame, PrimaryBtn, GhostBtn, Pill, Avatar, EntityTag,
    VoiceBars, Sticker, Scribble, ActivityRow, Stat, Wordmark, Icon,
  });
})();
