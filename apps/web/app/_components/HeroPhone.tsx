// @ts-nocheck
/* eslint-disable react-hooks/exhaustive-deps, @next/next/no-img-element */
'use client';

// Interactive hero demo inside the iPhone frame.
//   video  → the explainer plays
//   demo   → tab-bar + mic; real browser speech-to-text (Web Speech API,
//            scripted fallback where unsupported) → client-side heuristic
//            extraction → contact card + mini graph.
// The real capture pipeline lives in apps/app (server + keys); on the static
// landing this is a faithful demo replica built from the same design language.

import { useEffect, useMemo, useRef, useState } from 'react';
import { IphoneFrame, screenBox, IPHONE_ASPECT } from './Iphone';

const ACCENT = '#FFC452';
const SECOND = '#86efac';
const THIRD = '#FF8FAB';
const BLUE = '#7DD3FC';
const VIOLET = '#A78BFA';

const SAMPLE = 'Met Sarah Chen from Acme, she leads their Rust team. I should send her my repo tomorrow.';
const TOUR_KEY = 'wm.demo.tourSeen';

// ─────────────────── heuristic entity extraction (client-side) ───────────────────
const STOP = new Set(['I', 'Met', 'The', 'A', 'She', 'He', 'They', 'We', 'My', 'Their']);

function parseEntities(raw) {
  const text = (raw || '').trim();
  if (!text) return null;

  let name =
    (text.match(/\b(?:[Mm]et(?:\s+with)?|talked to|spoke (?:to|with)|meeting)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/) || [])[1] ||
    (text.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/) || [])[1] ||
    (text.match(/\b([A-Z][a-z]{2,})\b/g) || []).find((w) => !STOP.has(w)) ||
    'New contact';
  // strip a leading trigger word the fallback may have grabbed (e.g. "Met Sarah")
  const parts = name.split(/\s+/);
  if (parts.length > 1 && STOP.has(parts[0])) name = parts.slice(1).join(' ');

  const company = (text.match(/\b(?:from|at|works? at|joined)\s+([A-Z][A-Za-z0-9&.]+)/) || [])[1] || '';

  let topic =
    (text.match(/\b(?:working on|works on|leads?|building|about)\s+([a-zA-Z][a-zA-Z0-9 +/-]{2,26}?)(?=[.,!?]|$| and | but | so )/i) || [])[1]?.trim() || '';
  topic = topic.replace(/^(?:the|their|his|her|a|an|our)\s+/i, '').replace(/\s+team$/i, '').trim();

  const followup = /\b(send|email|remind|follow up|ping|intro|schedule|tomorrow|next week|call)\b/i.test(text)
    ? ((text.match(/\b(?:send|email|remind me to|follow up|ping|intro|schedule)\b[^.?!]*/i) || [])[0] || 'follow up').trim()
    : '';

  return { name, company, topic, followup };
}

// ─────────────────── Web Speech hook (with graceful fallback) ───────────────────
function useSpeech() {
  const recRef = useRef(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const finalRef = useRef('');

  useEffect(() => {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    setSupported(!!SR);
  }, []);

  const start = (onFail) => {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return false;
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    finalRef.current = '';
    setTranscript('');
    let got = false;
    rec.onresult = (e) => {
      got = true;
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalRef.current += chunk;
        else interim += chunk;
      }
      setTranscript((finalRef.current + ' ' + interim).trim());
    };
    // Permission denied / network / no-service → hand off to the scripted demo.
    rec.onerror = () => { setListening(false); onFail?.(); };
    rec.onend = () => { setListening(false); if (!got && !finalRef.current) onFail?.(); };
    recRef.current = rec;
    try { rec.start(); setListening(true); return true; } catch { return false; }
  };

  const stop = () => { try { recRef.current?.stop(); } catch {} setListening(false); };
  const reset = () => { finalRef.current = ''; setTranscript(''); };

  return { supported, listening, transcript, start, stop, reset };
}

// ─────────────────── voice bars ───────────────────
function Bars({ active }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT((x) => x + 1), 90);
    return () => clearInterval(id);
  }, [active]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 30 }}>
      {Array.from({ length: 24 }, (_, i) => {
        const s = (Math.sin(t * 0.5 + i * 0.7) + Math.cos(t * 0.3 + i)) * 0.5 + 0.5;
        return <div key={i} style={{ width: 3, height: active ? 5 + s * 24 : 4, borderRadius: 2, background: active ? ACCENT : 'rgba(255,255,255,0.2)', transition: 'height 0.12s' }} />;
      })}
    </div>
  );
}

// ─────────────────── mini relationship graph ───────────────────
function MiniGraph({ data }) {
  const nodes = [
    { id: 'you', label: 'You', x: 50, y: 30, c: '#fff' },
    { id: 'person', label: data.name.split(' ')[0] || 'Contact', x: 50, y: 92, c: ACCENT },
  ];
  if (data.company) nodes.push({ id: 'org', label: data.company, x: 14, y: 150, c: BLUE });
  if (data.topic) nodes.push({ id: 'topic', label: data.topic.split(' ').slice(0, 2).join(' '), x: 86, y: 150, c: VIOLET });
  const edges = [['you', 'person', 'met']];
  if (data.company) edges.push(['person', 'org', 'works_at']);
  if (data.topic) edges.push(['person', 'topic', 'expert_in']);
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  return (
    <svg viewBox="0 0 100 180" style={{ width: '100%', height: 150 }}>
      {edges.map(([a, b, rel], i) => {
        const A = byId[a], B = byId[b];
        if (!A || !B) return null;
        return (
          <g key={i}>
            <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="rgba(255,255,255,0.18)" strokeWidth="0.7" />
            <text x={(A.x + B.x) / 2} y={(A.y + B.y) / 2 - 2} fill="rgba(255,255,255,0.4)" fontSize="4.5" textAnchor="middle" fontFamily="monospace">{rel}</text>
          </g>
        );
      })}
      {nodes.map((n) => (
        <g key={n.id} style={{ animation: 'pulse-d 2.5s ease-in-out infinite' }}>
          <circle cx={n.x} cy={n.y} r="4.5" fill={n.c} />
          <text x={n.x} y={n.y + 12} fill="#fff" fontSize="6" textAnchor="middle" fontWeight="600">{n.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ─────────────────── contact card ───────────────────
function ContactCard({ data }) {
  const initial = (data.name || '?').trim()[0]?.toUpperCase() || '?';
  return (
    <div style={{ borderRadius: 14, padding: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, ${ACCENT}, ${THIRD})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#000', fontSize: 17 }}>{initial}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.name}</div>
          {data.company && <div className="mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{data.company}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: data.followup ? 12 : 0 }}>
        {data.company && <Chip c={BLUE} label="ORG">{data.company}</Chip>}
        {data.topic && <Chip c={VIOLET} label="TOPIC">{data.topic}</Chip>}
        <Chip c={SECOND} label="MET">today</Chip>
      </div>
      {data.followup && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#FF6B6B' }} />
          <span style={{ fontSize: 11.5, color: '#FF8888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>follow-up · {data.followup}</span>
        </div>
      )}
    </div>
  );
}
function Chip({ c, label, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999, background: `${c}18`, border: `1px solid ${c}40` }}>
      <span className="mono" style={{ fontSize: 8, fontWeight: 700, color: c, letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>{children}</span>
    </span>
  );
}

// ─────────────────── the in-phone demo app ───────────────────
function DemoScreen({ micRef, onMicHint }) {
  const speech = useSpeech();
  const [phase, setPhase] = useState('idle'); // idle | recording | extracting | result
  const [text, setText] = useState('');
  const [data, setData] = useState(null);
  const scriptTimer = useRef(null);
  const scriptedRef = useRef(false);

  useEffect(() => () => clearTimeout(scriptTimer.current), []);
  useEffect(() => { if (speech.listening) setText(speech.transcript); }, [speech.transcript, speech.listening]);

  const runScript = () => {
    // Fallback (no Web Speech, permission denied, or no result): type the sample.
    if (scriptedRef.current) return;
    scriptedRef.current = true;
    speech.stop();
    let i = 0;
    const tick = () => {
      i += 2;
      setText(SAMPLE.slice(0, i));
      if (i < SAMPLE.length) scriptTimer.current = setTimeout(tick, 45);
      else finish(SAMPLE);
    };
    tick();
  };

  const start = () => {
    onMicHint?.();
    scriptedRef.current = false;
    setData(null);
    setText('');
    setPhase('recording');
    if (!speech.start(() => runScript())) runScript();
  };

  const finish = (finalText) => {
    speech.stop();
    clearTimeout(scriptTimer.current);
    const src = (finalText || text || SAMPLE).trim() || SAMPLE;
    setPhase('extracting');
    setTimeout(() => { setData(parseEntities(src)); setPhase('result'); }, 850);
  };

  const reset = () => { speech.reset(); scriptedRef.current = false; setText(''); setData(null); setPhase('idle'); };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#08080d' }}>
      {/* app header */}
      <div style={{ padding: '10px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>wingmic</span>
        <span className="mono" style={{ fontSize: 9.5, color: phase === 'recording' ? '#FF6B6B' : 'rgba(255,255,255,0.35)' }}>
          {phase === 'recording' ? '● rec' : '● live'}
        </span>
      </div>

      {/* canvas */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '4px 14px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {phase === 'idle' && (
          <div style={{ margin: 'auto', textAlign: 'center', padding: '0 6px' }}>
            <div className="serif" style={{ fontStyle: 'italic', fontSize: 22, color: '#fff', lineHeight: 1.15, marginBottom: 10 }}>who did you just meet?</div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>tap the mic and say it out loud — like <span style={{ color: 'rgba(255,255,255,0.75)' }}>"met Sarah from Acme, she leads Rust…"</span></div>
          </div>
        )}

        {(phase === 'recording' || phase === 'extracting') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>
            {phase === 'recording' && <div style={{ display: 'flex', justifyContent: 'center' }}><Bars active /></div>}
            <div className="mono" style={{ fontSize: 9, color: ACCENT, letterSpacing: 1, textTransform: 'uppercase' }}>transcript</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 1.5, fontFamily: 'Instrument Serif, serif', fontStyle: 'italic', minHeight: 44 }}>
              {text || <span style={{ color: 'rgba(255,255,255,0.35)' }}>listening…</span>}
              {phase === 'recording' && <span style={{ display: 'inline-block', width: 2, height: 14, background: ACCENT, marginLeft: 2, verticalAlign: 'middle', animation: 'blink 0.7s infinite' }} />}
            </div>
            {phase === 'extracting' && (
              <div className="mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT, animation: 'pulse-d 0.9s infinite' }} />
                building your graph…
              </div>
            )}
          </div>
        )}

        {phase === 'result' && data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto' }}>
            <ContactCard data={data} />
            <div className="mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>graph</div>
            <MiniGraph data={data} />
            <button type="button" onClick={reset} className="mono" style={{ alignSelf: 'center', fontSize: 11, color: 'rgba(255,255,255,0.55)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>↺ try again</button>
          </div>
        )}
      </div>

      {/* tab bar with mic */}
      <div style={{ flexShrink: 0, height: 66, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 24px', position: 'relative' }}>
        <TabIcon label="home" />
        <div style={{ width: 56 }} />
        <TabIcon label="recall" />
        {/* center mic */}
        <button
          ref={micRef}
          type="button"
          aria-label={phase === 'recording' ? 'Stop recording' : 'Start recording'}
          onClick={() => (phase === 'recording' ? finish() : start())}
          style={{
            position: 'absolute', left: '50%', top: -18, transform: 'translateX(-50%)',
            width: 58, height: 58, borderRadius: '50%', border: '3px solid #08080d', cursor: 'pointer',
            background: phase === 'recording' ? '#FF6B6B' : ACCENT,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: phase === 'recording' ? '0 0 0 6px rgba(255,107,107,0.18)' : `0 6px 18px ${ACCENT}55`,
            transition: 'background 0.2s',
          }}>
          {phase === 'recording'
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            : <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="9" y="2" width="6" height="12" rx="3" fill="#000" /><path d="M5 11a7 7 0 0014 0" stroke="#000" strokeWidth="2" strokeLinecap="round" /><path d="M12 18v3" stroke="#000" strokeWidth="2" strokeLinecap="round" /></svg>}
        </button>
      </div>
    </div>
  );
}
function TabIcon({ label }) {
  return <span className="mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>;
}

// ─────────────────── 3-step first-visit tour ───────────────────
const TOUR_STEPS = [
  { t: 'tap the mic', d: 'say who you just met — out loud, like a voice note.' },
  { t: 'we transcribe live', d: 'your voice becomes text as you talk. no typing.' },
  { t: 'card + graph, instantly', d: 'people, companies and follow-ups — queryable later.' },
];

function Tour({ step, onNext, onSkip }) {
  const s = TOUR_STEPS[step];
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 4, background: 'rgba(0,0,0,0.55)', borderRadius: 'inherit' }}>
      {/* highlight ring on the mic (bottom center) */}
      <div style={{ position: 'absolute', left: '50%', bottom: 30, transform: 'translateX(-50%)', width: 74, height: 74, borderRadius: '50%', border: `2px solid ${ACCENT}`, animation: 'pulse-d 1.3s ease-in-out infinite', pointerEvents: 'none' }} />
      {/* caption */}
      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 118, padding: 14, borderRadius: 12, background: '#14141b', border: `1px solid ${ACCENT}40`, boxShadow: '0 12px 30px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span className="mono" style={{ fontSize: 10, color: ACCENT, letterSpacing: 1 }}>{step + 1} / 3</span>
          <button type="button" onClick={onSkip} className="mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>skip</button>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{s.t}</div>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.45, marginBottom: 12 }}>{s.d}</div>
        <button type="button" onClick={onNext} style={{ width: '100%', padding: '9px 0', borderRadius: 8, background: ACCENT, color: '#000', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {step < 2 ? 'next →' : 'got it'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────── the hero phone (frame + mode switch + tour) ───────────────────
export default function HeroPhone({ width = 300 }) {
  const [mode, setMode] = useState('video'); // video | demo
  const [tourStep, setTourStep] = useState(-1); // -1 = inactive
  const videoRef = useRef(null);
  const micRef = useRef(null);

  useEffect(() => { videoRef.current?.play?.().catch(() => {}); }, [mode]);

  // First-visit tour: flips into demo mode and walks 3 steps.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let seen = null;
    try { seen = window.localStorage.getItem(TOUR_KEY); } catch {}
    if (seen) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduce) return;
    const id = setTimeout(() => { setMode('demo'); setTourStep(0); }, 1400);
    return () => clearTimeout(id);
  }, []);

  const endTour = () => {
    setTourStep(-1);
    try { window.localStorage.setItem(TOUR_KEY, '1'); } catch {}
  };
  const nextTour = () => (tourStep < 2 ? setTourStep((s) => s + 1) : endTour());

  return (
    <div style={{ width: '100%', maxWidth: width }}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: IPHONE_ASPECT, filter: 'drop-shadow(0 26px 50px rgba(0,0,0,0.55))' }}>
        {/* frame behind */}
        <IphoneFrame style={{ zIndex: 0 }} />

        {/* screen */}
        <div style={{ position: 'absolute', overflow: 'hidden', zIndex: 1, background: '#050509', ...screenBox }}>
          {mode === 'video' ? (
            <video
              ref={videoRef}
              src="/wingmic-explainer.mp4"
              autoPlay muted loop playsInline controls preload="auto"
              aria-label="wingmic product explainer"
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <DemoScreen micRef={micRef} onMicHint={() => tourStep === 0 && nextTour()} />
          )}

          {/* tour lives inside the screen so the spotlight aligns with the mic */}
          {mode === 'demo' && tourStep >= 0 && <Tour step={tourStep} onNext={nextTour} onSkip={endTour} />}
        </div>

        {/* Dynamic Island */}
        <div aria-hidden style={{ position: 'absolute', zIndex: 2, top: '3.5%', left: '50%', transform: 'translateX(-50%)', width: '28.5%', height: '4.1%', background: '#08080c', borderRadius: 999, pointerEvents: 'none' }} />
      </div>

      {/* mode toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
        <div style={{ display: 'inline-flex', padding: 4, borderRadius: 999, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {[['video', '▶ explainer'], ['demo', '✨ try it live']].map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                padding: '7px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
                background: mode === m ? ACCENT : 'transparent',
                color: mode === m ? '#000' : 'rgba(255,255,255,0.6)',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
