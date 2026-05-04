// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react/no-unescaped-entities, @next/next/no-img-element */
'use client';

import { useEffect, useRef, useState } from 'react';

// ─────────────────── Living graph background (canvas) ───────────────────
function LiveGraph({ accent, second, third, density = 1 }) {
  const ref = useRef(null);
  const accentRef = useRef(accent);
  useEffect(() => {accentRef.current = accent;}, [accent]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      const w = canvas.clientWidth,h = canvas.clientHeight;
      canvas.width = w * dpr;canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);ro.observe(canvas);

    const palette = [accent, second, third, '#fff'];
    const N = Math.floor(60 * density);
    const nodes = Array.from({ length: N }, (_, i) => ({
      x: Math.random() * canvas.clientWidth,
      y: Math.random() * canvas.clientHeight,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      r: 1.5 + Math.random() * 2.5,
      color: palette[i % palette.length],
      pulse: Math.random() * Math.PI * 2
    }));

    let frame;
    const tick = () => {
      const w = canvas.clientWidth,h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      // edges
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = nodes[i],b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > 160) continue;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(255,196,82,${0.07 * (1 - d / 160)})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
      nodes.forEach((n) => {
        n.x += n.vx;n.y += n.vy;n.pulse += 0.02;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        const pulseAmt = 0.6 + Math.sin(n.pulse) * 0.4;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * pulseAmt, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = 0.65;
        ctx.fill();
        ctx.globalAlpha = 1;
      });
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {cancelAnimationFrame(frame);ro.disconnect();};
  }, [density, second, third]);

  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}

// ─────────────────── Voice waveform that reacts ───────────────────
function VoiceBars({ active, accent, count = 22 }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setPhase((p) => p + 1), 80);
    return () => clearInterval(id);
  }, [active]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 40 }}>
      {Array.from({ length: count }, (_, i) => {
        const seed = (Math.sin(phase * 0.6 + i * 0.7) + Math.cos(phase * 0.3 + i * 1.1)) * 0.5 + 0.5;
        const h = active ? 6 + seed * 32 : 4;
        return <div key={i} style={{
          width: 3, height: h, borderRadius: 2,
          background: active ? accent : 'rgba(255,255,255,0.2)',
          transition: 'height 0.12s ease-out'
        }} />;
      })}
    </div>);

}

// ─────────────────── Editorial number with hand label ───────────────────
function StatBlock({ value, label, color, rotate = -2, sub }) {
  return (
    <div style={{ position: 'relative', textAlign: 'center', transform: `rotate(${rotate}deg)`, animation: 'drift-up 6s ease-in-out infinite', '--r': `${rotate}deg` }}>
      <div className="serif" style={{ fontSize: 'clamp(80px, 14vw, 180px)', lineHeight: 0.85, color, fontWeight: 400, letterSpacing: '-0.04em', fontStyle: 'italic' }}>
        {value}
      </div>
      <div className="mono" style={{ fontSize: 11, marginTop: 8, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2 }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: 13, marginTop: 4, color: 'rgba(255,255,255,0.4)' }}>{sub}</div>}
    </div>);

}

// ─────────────────── Sticker / Badge ───────────────────
function Sticker({ children, color, rotate = 0, x, y, size = 'sm' }) {
  return (
    <div className="mono" style={{
      position: 'absolute', left: x, top: y,
      transform: `rotate(${rotate}deg)`,
      padding: size === 'lg' ? '10px 16px' : '5px 10px',
      borderRadius: 999,
      background: color,
      color: '#0a0a0a',
      fontSize: size === 'lg' ? 13 : 10,
      fontWeight: 700,
      letterSpacing: 1,
      textTransform: 'uppercase',
      boxShadow: '3px 3px 0 rgba(0,0,0,0.2)',
      whiteSpace: 'nowrap',
      zIndex: 5
    }}>
      {children}
    </div>);

}

// ─────────────────── Mini phone with live capture ───────────────────
function MiniPhone({ accent }) {
  const [phase, setPhase] = useState(0);
  const transcript = "Met Sarah from Acme — Rust lead. Send repo tomorrow.";
  const [chars, setChars] = useState(0);

  useEffect(() => {
    const cycle = setInterval(() => {
      setPhase((p) => (p + 1) % 4);
      setChars(0);
    }, 4500);
    return () => clearInterval(cycle);
  }, []);

  useEffect(() => {
    if (phase !== 1) return;
    const id = setInterval(() => {
      setChars((c) => c < transcript.length ? c + 1 : c);
    }, 50);
    return () => clearInterval(id);
  }, [phase]);

  return (
    <div style={{
      width: 280, height: 560, borderRadius: 36, overflow: 'hidden',
      background: '#0a0a10',
      border: '8px solid #1a1a20',
      boxShadow: '0 30px 60px rgba(0,0,0,0.5), inset 0 0 40px rgba(255,196,82,0.05)',
      display: 'flex', flexDirection: 'column',
      position: 'relative'
    }}>
      {/* Notch */}
      <div style={{ height: 24, background: '#1a1a20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 60, height: 14, borderRadius: 8, background: '#0a0a10' }} />
      </div>
      {/* Header */}
      <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: accent }}>wingmic</span>
        <span className="mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>● live</span>
      </div>

      {/* Center stage */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 18 }}>
        {/* Mic + waves */}
        <div style={{ position: 'relative', width: 100, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {phase === 1 && [0, 1, 2].map((i) =>
          <div key={i} style={{
            position: 'absolute',
            width: 100 + i * 30, height: 100 + i * 30, borderRadius: '50%',
            border: `1.5px solid ${accent}`,
            opacity: 0.4 - i * 0.1,
            animation: `pulse-d ${1.2 + i * 0.4}s ease-in-out infinite`
          }} />
          )}
          <div style={{
            width: 70, height: 70, borderRadius: '50%',
            background: phase === 1 ? accent : 'rgba(255,255,255,0.06)',
            border: phase === 1 ? `2px solid ${accent}` : '2px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.3s'
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="2" width="6" height="12" rx="3" fill={phase === 1 ? '#000' : 'rgba(255,255,255,0.5)'} />
              <path d="M5 11a7 7 0 0014 0" stroke={phase === 1 ? '#000' : 'rgba(255,255,255,0.5)'} strokeWidth="2" strokeLinecap="round" />
              <path d="M12 18v3" stroke={phase === 1 ? '#000' : 'rgba(255,255,255,0.5)'} strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        <VoiceBars active={phase === 1} accent={accent} />

        {/* Transcript bubble */}
        {phase >= 1 &&
        <div style={{
          padding: '10px 12px', borderRadius: 12, fontSize: 12,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
          color: 'rgba(255,255,255,0.75)', minHeight: 50, lineHeight: 1.4
        }}>
            {transcript.slice(0, chars)}
            {phase === 1 && chars < transcript.length &&
          <span style={{ display: 'inline-block', width: 2, height: 12, background: accent, marginLeft: 1, verticalAlign: 'middle', animation: 'blink 0.7s infinite' }} />
          }
          </div>
        }

        {/* Extracted */}
        {phase >= 2 &&
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="mono" style={{ fontSize: 9, color: accent, letterSpacing: 1, textTransform: 'uppercase' }}>extracted</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {[
            { label: 'Sarah Chen', color: accent },
            { label: 'Acme', color: '#7DD3FC' },
            { label: 'edge_config', color: '#A78BFA' }].
            map((t) =>
            <span key={t.label} style={{
              padding: '3px 8px', borderRadius: 999,
              background: `${t.color}20`, color: t.color,
              fontSize: 10, fontWeight: 600
            }}>{t.label}</span>
            )}
            </div>
            {phase >= 3 &&
          <div style={{
            marginTop: 6, padding: '6px 10px', borderRadius: 8,
            background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)',
            fontSize: 10, color: '#FF8888', display: 'flex', alignItems: 'center', gap: 6
          }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#FF6B6B' }} />
                Follow-up scheduled · tomorrow 9am
              </div>
          }
          </div>
        }
      </div>

      {/* Home indicator */}
      <div style={{ height: 18, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ width: 100, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
      </div>
    </div>);

}

// ─────────────────── How-it-works numbered step ───────────────────
function Step({ n, title, body, side, accent }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: side === 'L' ? '1fr 1fr' : '1fr 1fr',
      gap: 60, alignItems: 'center', padding: '60px 0',
      borderTop: '1px solid rgba(255,255,255,0.08)'
    }}>
      <div style={{ order: side === 'L' ? 0 : 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 16 }}>
          <span className="serif" style={{ fontSize: 100, fontStyle: 'italic', color: accent, lineHeight: 1, letterSpacing: '-0.04em' }}>{n}</span>
          <div className="mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, textTransform: 'uppercase' }}>step</div>
        </div>
        <h3 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.05, marginBottom: 16 }}>{title}</h3>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, maxWidth: 460 }}>{body}</p>
      </div>
      <div style={{ order: side === 'L' ? 1 : 0, display: 'flex', justifyContent: 'center' }}>
        {/* slot for visual */}
      </div>
    </div>);

}

// ─────────────────── Code snippet block ───────────────────
function CodeBlock({ filename, lines, accent }) {
  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden',
      background: '#08080d',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 20px 50px rgba(0,0,0,0.4)'
    }}>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f56' }} />
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ffbd2e' }} />
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#27ca3f' }} />
        </div>
        <span className="mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{filename}</span>
        <div style={{ width: 30 }} />
      </div>
      <pre className="mono" style={{ padding: '18px 22px', fontSize: 12.5, lineHeight: 1.75, color: 'rgba(255,255,255,0.85)', overflow: 'auto' }}>
        {lines.map((l, i) =>
        <div key={i} style={{ color: l.kind === 'comment' ? 'rgba(255,255,255,0.35)' : l.kind === 'string' ? '#86efac' : l.kind === 'keyword' ? accent : 'rgba(255,255,255,0.85)' }}>
            {l.text}
          </div>
        )}
      </pre>
    </div>);

}

// ─────────────────── Marquee ───────────────────
function MarqueeRow({ items, accent, reverse }) {
  return (
    <div style={{ overflow: 'hidden', maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}>
      <div style={{
        display: 'flex', gap: 16,
        animation: `marquee ${reverse ? 38 : 42}s linear infinite`,
        animationDirection: reverse ? 'reverse' : 'normal',
        width: 'max-content'
      }}>
        {[...items, ...items].map((it, i) =>
        <div key={i} style={{
          flexShrink: 0, width: 360, padding: 22,
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16,
          transform: i % 3 === 0 ? 'rotate(-0.4deg)' : i % 3 === 1 ? 'rotate(0.5deg)' : 'rotate(0deg)'
        }}>
            <div className="serif" style={{ fontSize: 28, fontStyle: 'italic', color: accent, lineHeight: 1, marginBottom: 8 }}>"</div>
            <div style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.78)', lineHeight: 1.55, marginBottom: 16 }}>{it.quote}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: `linear-gradient(135deg, ${accent}, ${it.alt || '#FF6B6B'})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: '#000'
            }}>{it.who[0]}</div>
              <div>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>{it.who}</div>
                <div className="mono" style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>{it.role}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>);

}

// ─────────────────── Live "now happening" feed ───────────────────
function LiveFeed({ accent }) {
  const events = [
  { who: 'devansh.eth', what: 'captured', detail: '"Coffee w/ Marcus — talked indexers"', t: 'now' },
  { who: 'lina_b', what: 'queried', detail: '"who knows about ZK proofs?"', t: '12s' },
  { who: 'jamie_p', what: 'follow-up done', detail: 'Sent intro to Sarah → Eli', t: '34s' },
  { who: 'alex.rs', what: 'graph grew', detail: '+3 nodes, +5 edges from DevConnect', t: '1m' },
  { who: 'priya', what: 'captured', detail: '"Met Yuki, eng @ Cloudflare"', t: '2m' },
  { who: 'marc', what: 'queried via MCP', detail: 'Claude pulled 12 contacts for cold email', t: '3m' }];

  const [pos, setPos] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPos((p) => p + 1), 1800);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      maxHeight: 340, overflow: 'hidden', position: 'relative'
    }}>
      {events.map((e, i) => {
        const offset = (i - pos % events.length + events.length) % events.length;
        const isVisible = offset < 4;
        const opacity = isVisible ? 1 - offset * 0.2 : 0;
        return (
          <div key={i} style={{
            opacity, transition: 'opacity 0.5s',
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px', borderRadius: 10,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, animation: 'pulse-d 1.5s infinite' }} />
            <div className="mono" style={{ fontSize: 11, color: accent, minWidth: 90 }}>{e.who}</div>
            <div className="mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', minWidth: 90 }}>{e.what}</div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.detail}</div>
            <div className="mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{e.t}</div>
          </div>);

      })}
    </div>);

}

export { LiveGraph, VoiceBars, StatBlock, Sticker, MiniPhone, Step, CodeBlock, MarqueeRow, LiveFeed };
