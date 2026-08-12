// @ts-nocheck
/* eslint-disable react-hooks/exhaustive-deps, @next/next/no-img-element */
'use client';

import { useEffect, useRef, useState } from 'react';
import { IphoneFrame, screenBox, IPHONE_ASPECT } from './Iphone';

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

// ─────────────────── iPhone frame playing the product explainer ───────────────────
function PhoneVideo({ accent, width = 300 }) {
  const videoRef = useRef(null);
  const trackRef = useRef(null);

  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [hover, setHover] = useState(false);

  // Nudge autoplay on mobile browsers that ignore the attribute until a play() call.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
  }, []);

  const fmt = (s) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${m}:${ss < 10 ? '0' : ''}${ss}`;
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const seekToClientX = (clientX) => {
    const v = videoRef.current;
    const t = trackRef.current;
    if (!v || !t || !v.duration) return;
    const r = t.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    v.currentTime = ratio * v.duration;
    setCur(v.currentTime);
  };

  const progress = dur ? cur / dur : 0;
  const controlsVisible = hover || !playing;

  const iconBtn = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
    background: 'rgba(0,0,0,0.4)', border: 'none', cursor: 'pointer', color: '#fff', padding: 0,
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', width: '100%', maxWidth: width, aspectRatio: IPHONE_ASPECT,
        filter: 'drop-shadow(0 26px 50px rgba(0,0,0,0.55))',
      }}>

      {/* Screen — the live video, behind the frame so the island overlays it */}
      <div style={{ position: 'absolute', overflow: 'hidden', zIndex: 0, background: '#050509', ...screenBox }}>
        <video
          ref={videoRef}
          src="/wingmic-explainer.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-label="wingmic product explainer"
          onClick={togglePlay}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
          onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
        />
      </div>

      {/* iPhone frame (Magic UI) — decorative, click-through */}
      <IphoneFrame style={{ zIndex: 1 }} />

      {/* Player controls — above everything, positioned inside the screen */}
      <div style={{ position: 'absolute', zIndex: 2, overflow: 'hidden', pointerEvents: 'none', ...screenBox }}>
        {/* Center play affordance — while paused */}
        {!playing && (
          <button
            type="button"
            aria-label="Play"
            onClick={togglePlay}
            style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              width: 62, height: 62, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 22px rgba(0,0,0,0.45)', pointerEvents: 'auto',
            }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#000"><path d="M8 5v14l11-7z" /></svg>
          </button>
        )}

        {/* Control bar */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: '26px 14px 16px',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.65))',
          opacity: controlsVisible ? 1 : 0,
          transition: 'opacity 0.2s ease',
          pointerEvents: controlsVisible ? 'auto' : 'none',
        }}>
          {/* Seek / peek bar */}
          <div
            ref={trackRef}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); seekToClientX(e.clientX); }}
            onPointerMove={(e) => { if (e.buttons === 1) seekToClientX(e.clientX); }}
            style={{ height: 16, display: 'flex', alignItems: 'center', cursor: 'pointer', touchAction: 'none' }}>
            <div style={{ position: 'relative', width: '100%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${progress * 100}%`, background: accent, borderRadius: 2 }} />
              <div style={{ position: 'absolute', left: `${progress * 100}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 11, height: 11, borderRadius: '50%', background: accent, boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }} />
            </div>
          </div>

          {/* Buttons row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <button type="button" aria-label={playing ? 'Pause' : 'Play'} onClick={togglePlay} style={iconBtn}>
              {playing
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>}
            </button>
            <span className="mono" style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1 }}>
              {fmt(cur)} / {fmt(dur)}
            </span>
            <div style={{ flex: 1 }} />
            <button type="button" aria-label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute} style={iconBtn}>
              {muted
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H3v6h3l5 4V5z" fill="#fff" stroke="none" /><path d="M17 9l4 6M21 9l-4 6" /></svg>
                : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H3v6h3l5 4V5z" fill="#fff" stroke="none" /><path d="M15.5 8.5a5 5 0 010 7" /></svg>}
            </button>
          </div>
        </div>
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

export { LiveGraph, VoiceBars, StatBlock, Sticker, PhoneVideo, Step, CodeBlock, LiveFeed };
