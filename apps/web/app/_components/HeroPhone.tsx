// @ts-nocheck
/* eslint-disable react-hooks/exhaustive-deps, @next/next/no-img-element */
'use client';

// Interactive hero demo inside the iPhone frame.
//   video → explainer plays
//   demo  → mic → POST /api/demo/capture (audio, or transcript fallback)

import { useCallback, useEffect, useRef, useState } from 'react';
import { IphoneFrame, screenBox, IPHONE_ASPECT } from './Iphone';
import WaitlistForm from './WaitlistForm';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3211';
const IS_LOCAL_APP = APP_URL.includes('localhost') || APP_URL.includes('127.0.0.1');
const ACCENT = '#FFC452';
const SECOND = '#86efac';
const THIRD = '#FF8FAB';
const BLUE = '#7DD3FC';
const VIOLET = '#A78BFA';


const STOP = new Set(['I', 'Met', 'The', 'A', 'She', 'He', 'They', 'We', 'My', 'Their']);

function parseEntities(raw) {
  const text = (raw || '').trim();
  if (!text) return null;

  let name =
    (text.match(/\b(?:[Mm]et(?:\s+with)?|talked to|spoke (?:to|with)|meeting)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/) || [])[1] ||
    (text.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/) || [])[1] ||
    (text.match(/\b([A-Z][a-z]{2,})\b/g) || []).find((w) => !STOP.has(w)) ||
    'New contact';
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

function fromExtraction(extracted, transcript) {
  const person = extracted?.persons?.[0];
  const fallback = parseEntities(transcript);
  return {
    name: person?.name || fallback?.name || 'New contact',
    company: person?.companyHint || extracted?.companies?.[0]?.name || fallback?.company || '',
    topic: person?.topics?.[0] || extracted?.topics?.[0] || fallback?.topic || '',
    followup: extracted?.actions?.[0]?.body || fallback?.followup || '',
  };
}

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return undefined;
  for (const c of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

/** Browser STT when server-side ASR is unavailable. Do not run alongside MediaRecorder — mic conflict. */
function useSpeechCapture() {
  const recRef = useRef(null);
  const stoppedRef = useRef(true);
  const textRef = useRef('');
  const [live, setLive] = useState('');

  useEffect(() => () => {
    stoppedRef.current = true;
    try { recRef.current?.abort?.(); } catch {}
  }, []);

  const start = useCallback(() => {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return false;
    stoppedRef.current = false;
    textRef.current = '';
    setLive('');

    const listen = () => {
      if (stoppedRef.current) return;
      const rec = new SR();
      rec.lang = 'en-US';
      rec.interimResults = true;
      rec.continuous = true;
      rec.onresult = (e) => {
        let chunk = '';
        for (let i = 0; i < e.results.length; i++) chunk += e.results[i][0].transcript;
        textRef.current = chunk.trim();
        setLive(textRef.current);
      };
      rec.onerror = (ev) => {
        if (ev?.error === 'not-allowed' || ev?.error === 'audio-capture') stoppedRef.current = true;
      };
      rec.onend = () => {
        if (!stoppedRef.current) setTimeout(listen, 120);
      };
      recRef.current = rec;
      try { rec.start(); } catch {}
    };
    listen();
    return true;
  }, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    try { recRef.current?.stop(); } catch {}
    return textRef.current.trim();
  }, []);

  return { live, start, stop };
}

function useAsrMode() {
  const [ready, setReady] = useState(false);
  const [asr, setAsr] = useState(false);
  useEffect(() => {
    fetch(`${APP_URL}/api/demo/status`)
      .then((r) => r.json())
      .then((d) => setAsr(!!d.asr))
      .catch(() => setAsr(false))
      .finally(() => setReady(true));
  }, []);
  return { asr, ready };
}

async function postDemo({ blob, transcript } = {}) {
  const form = new FormData();
  if (blob) form.append('audio', blob, 'demo.webm');
  if (transcript) form.append('transcript', transcript);
  const res = await fetch(`${APP_URL}/api/demo/capture`, { method: 'POST', body: form });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

function useDemoRecorder() {
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('mic unavailable in this browser.');
    }
    cleanup();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mimeType = pickMimeType();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data?.size) chunksRef.current.push(e.data);
    };
    rec.start(250);
    setRecording(true);
  }, [cleanup]);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === 'inactive') {
        cleanup();
        setRecording(false);
        resolve(null);
        return;
      }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        cleanup();
        setRecording(false);
        resolve(blob.size > 0 ? blob : null);
      };
      try {
        rec.stop();
      } catch {
        cleanup();
        setRecording(false);
        resolve(null);
      }
    });
  }, [cleanup]);

  return { recording, start, stop };
}

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

// Shared capture state machine — one implementation, two layouts (phone + mac).
function useDemoCapture() {
  const { asr, ready: asrReady } = useAsrMode();
  const recorder = useDemoRecorder();
  const speech = useSpeechCapture();
  const [phase, setPhase] = useState('idle');
  const [text, setText] = useState('');
  const [data, setData] = useState(null);
  const [hint, setHint] = useState('');
  const maxTimer = useRef(null);
  const busyRef = useRef(false);
  const startedAtRef = useRef(0);

  useEffect(() => () => clearTimeout(maxTimer.current), []);

  const showResult = (result, transcript) => {
    setText(result?.transcript ?? transcript);
    setData(fromExtraction(result?.extracted, result?.transcript ?? transcript));
    setPhase('result');
  };

  const finish = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    clearTimeout(maxTimer.current);
    setPhase('extracting');
    try {
      if (asr) {
        const elapsed = performance.now() - startedAtRef.current;
        if (elapsed < 1200) {
          await recorder.stop();
          setPhase('idle');
          setHint('speak for at least 2 seconds, then tap stop');
          return;
        }
        const blob = await recorder.stop();
        if (!blob) {
          setPhase('idle');
          setHint("didn't catch that — tap and try again");
          return;
        }
        const first = await postDemo({ blob });
        if (first.ok) {
          showResult(first.body, first.body.transcript);
          return;
        }
        setPhase('idle');
        setHint(first.body?.error?.message ?? "couldn't run the demo — try again");
        return;
      }

      const transcript = speech.stop();
      if (!transcript) {
        setPhase('idle');
        setHint("didn't catch speech — try Chrome and speak clearly");
        return;
      }
      const second = await postDemo({ transcript });
      if (second.ok) {
        showResult(second.body, transcript);
        return;
      }
      setText(transcript);
      setData(fromExtraction(null, transcript));
      setPhase('result');
    } catch {
      setPhase('idle');
      setHint(IS_LOCAL_APP
        ? `couldn't reach demo server — is ${APP_URL} running?`
        : 'demo unavailable — try again in a moment');
    } finally {
      busyRef.current = false;
    }
  };

  const start = async () => {
    setHint('');
    setData(null);
    setText('');
    startedAtRef.current = performance.now();
    try {
      if (asr) {
        await recorder.start();
      } else if (!speech.start()) {
        setPhase('idle');
        setHint('browser speech unavailable — try Chrome');
        return;
      }
      setPhase('recording');
      maxTimer.current = setTimeout(() => finish(), 30000);
    } catch (err) {
      setPhase('idle');
      setHint(err instanceof Error && err.name === 'NotAllowedError'
        ? 'mic blocked — allow access in your browser settings'
        : 'mic unavailable — try Chrome or Safari');
    }
  };

  const reset = () => {
    clearTimeout(maxTimer.current);
    setText('');
    setData(null);
    setHint('');
    setPhase('idle');
  };

  const onMicClick = () => {
    if (!asrReady || phase === 'extracting') return;
    if (phase === 'recording') finish();
    else if (phase === 'idle' || phase === 'result') start();
  };

  return { phase, text, data, hint, asr, asrReady, live: speech.live, onMicClick, reset };
}

// ─────────────────── phone (portrait) demo layout ───────────────────
function DemoScreen({ micRef }) {
  const { phase, text, data, hint, asr, asrReady, live, onMicClick, reset } = useDemoCapture();

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#08080d' }}>
      <div style={{ padding: '10px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>wingmic</span>
        <span className="mono" style={{ fontSize: 9.5, color: phase === 'recording' ? '#FF6B6B' : '#86efac', animation: 'pulse-d 1.6s ease-in-out infinite' }}>
          {phase === 'recording' ? '● rec' : '● live'}
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', padding: '4px 14px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {phase === 'idle' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, padding: '4px 10px' }}>
            {/* hero copy, verbatim + same styling, scaled to the frame */}
            <h2 style={{ fontSize: 27, fontWeight: 900, lineHeight: 0.92, letterSpacing: '-0.045em', margin: 0 }}>
              <span style={{ display: 'block' }}>You met</span>
              <span style={{ display: 'block' }}>
                <span className="serif" style={{ fontStyle: 'italic', fontWeight: 400, color: ACCENT }}>twelve</span> people
              </span>
              <span style={{ display: 'block' }}>this week.</span>
              <span style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: '0.55em', fontWeight: 600, marginTop: 10, fontFamily: 'system-ui' }}>
                <span style={{ color: 'rgb(224, 165, 47)' }}>Wingmic remembers</span> <span className="scribble" style={{ color: 'rgb(255, 255, 255)' }}>everyone</span>.
              </span>
            </h2>
            <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, margin: 0 }}>
              Voice-first networking memory. Speak for a few seconds after you meet someone — Wingmic remembers the people, companies, and follow-ups for you.
            </p>
            <div className="mono" style={{ fontSize: 10.5, color: ACCENT, letterSpacing: 0.5 }}>tap the mic to try it ↓</div>
            {hint && <div className="mono" style={{ fontSize: 11, color: THIRD }}>{hint}</div>}
          </div>
        )}

        {(phase === 'recording' || phase === 'extracting') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>
            {phase === 'recording' && <div style={{ display: 'flex', justifyContent: 'center' }}><Bars active /></div>}
            <div className="mono" style={{ fontSize: 9, color: ACCENT, letterSpacing: 1, textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
              <span>{phase === 'extracting' ? 'transcribing' : 'recording'}</span>
              {phase === 'recording' && <span style={{ color: 'rgba(255,255,255,0.4)' }}>tap mic to stop ■</span>}
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 1.5, fontFamily: 'Instrument Serif, serif', fontStyle: 'italic', minHeight: 44 }}>
              {phase === 'extracting'
                ? (text || <span style={{ color: 'rgba(255,255,255,0.35)' }}>sending to wingmic…</span>)
                : (live || <span style={{ color: 'rgba(255,255,255,0.35)' }}>{asr ? 'speak now — tap mic when done' : 'listening… say who you met'}</span>)}
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
            {text && (
              <div className="mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.45, fontStyle: 'normal' }}>
                "{text.length > 120 ? `${text.slice(0, 117)}…` : text}"
              </div>
            )}
            <ContactCard data={data} />
            <div className="mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>graph</div>
            <MiniGraph data={data} />
            <WaitlistForm compact accent={ACCENT} source="wingmic.xyz/demo" />
            <button type="button" onClick={reset} className="mono" style={{ alignSelf: 'center', fontSize: 11, color: 'rgba(255,255,255,0.55)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>↺ try again</button>
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, height: 66, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 24px', position: 'relative' }}>
        <TabIcon label="home" />
        <div style={{ width: 56 }} />
        <TabIcon label="recall" />
        <button
          ref={micRef}
          type="button"
          aria-label={phase === 'recording' ? 'Stop recording' : 'Start recording'}
          onClick={onMicClick}
          disabled={!asrReady || phase === 'extracting'}
          style={{
            position: 'absolute', left: '50%', top: -18, transform: 'translateX(-50%)',
            width: 58, height: 58, borderRadius: '50%', border: '3px solid #08080d', cursor: !asrReady || phase === 'extracting' ? 'wait' : 'pointer',
            background: phase === 'recording' ? '#FF6B6B' : ACCENT,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: phase === 'recording' ? '0 0 0 6px rgba(255,107,107,0.18)' : `0 6px 18px ${ACCENT}55`,
            animation: phase === 'idle' ? 'mic-pulse 1.8s ease-in-out infinite' : undefined,
            transition: 'background 0.2s',
            opacity: phase === 'extracting' ? 0.7 : 1,
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

// ─────────────────── shared record button ───────────────────
function BigMic({ recording, disabled, onClick, size = 76 }) {
  return (
    <button
      type="button"
      aria-label={recording ? 'Stop recording' : 'Start recording'}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: size, height: size, borderRadius: '50%', border: 'none', flexShrink: 0,
        cursor: disabled ? 'wait' : 'pointer',
        background: recording ? '#FF6B6B' : ACCENT,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: recording ? '0 0 0 8px rgba(255,107,107,0.16)' : `0 8px 26px ${ACCENT}55`,
        animation: !recording && !disabled ? 'mic-pulse 1.8s ease-in-out infinite' : undefined,
        transition: 'background 0.2s', opacity: disabled && !recording ? 0.7 : 1,
      }}>
      {recording
        ? <svg width={size * 0.3} height={size * 0.3} viewBox="0 0 24 24" fill="#fff"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
        : <svg width={size * 0.36} height={size * 0.36} viewBox="0 0 24 24" fill="none"><rect x="9" y="2" width="6" height="12" rx="3" fill="#000" /><path d="M5 11a7 7 0 0014 0" stroke="#000" strokeWidth="2" strokeLinecap="round" /><path d="M12 18v3" stroke="#000" strokeWidth="2" strokeLinecap="round" /></svg>}
    </button>
  );
}

// ─────────────────── MacBook (landscape) demo layout ───────────────────
function DesktopDemo({ mode }) {
  const { phase, text, data, hint, asr, asrReady, live, onMicClick, reset } = useDemoCapture();
  const recording = phase === 'recording';

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#08080d' }}>
      {/* window bar */}
      <div style={{ height: 34, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {['#ff5f56', '#ffbd2e', '#27c93f'].map((c) => <span key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
        <span className="mono" style={{ marginLeft: 10, fontSize: 12.5, fontWeight: 700, color: ACCENT }}>wingmic</span>
        <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: recording ? '#FF6B6B' : '#86efac', animation: 'pulse-d 1.6s ease-in-out infinite' }}>{recording ? '● rec' : '● live'}</span>
      </div>

      {/* body: hero copy | live panel — bounded row so the video can't grow it */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gridTemplateRows: 'minmax(0, 1fr)', gap: 'clamp(24px, 4%, 60px)', alignItems: 'center', padding: 'clamp(22px, 4.5%, 56px)', overflow: 'hidden' }}>
        {/* left — verbatim hero copy */}
        <div>
          <h2 style={{ fontSize: 'clamp(34px, 4.6vw, 64px)', fontWeight: 900, lineHeight: 0.92, letterSpacing: '-0.045em', margin: 0 }}>
            <span style={{ display: 'block' }}>You met</span>
            <span style={{ display: 'block' }}><span className="serif" style={{ fontStyle: 'italic', fontWeight: 400, color: ACCENT }}>twelve</span> people</span>
            <span style={{ display: 'block' }}>this week.</span>
            <span style={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: '0.5em', fontWeight: 600, marginTop: 14, fontFamily: 'system-ui' }}>
              <span style={{ color: 'rgb(224, 165, 47)' }}>Wingmic remembers</span> <span className="scribble" style={{ color: 'rgb(255, 255, 255)' }}>everyone</span>.
            </span>
          </h2>
          <p style={{ fontSize: 'clamp(13px, 1.15vw, 16px)', color: 'rgba(255,255,255,0.55)', lineHeight: 1.55, margin: '18px 0 0', maxWidth: 440 }}>
            Voice-first networking memory. Speak for a few seconds after you meet someone — Wingmic remembers the people, companies, and follow-ups for you.
          </p>
        </div>

        {/* right — explainer video, or the live capture panel */}
        <div style={{ height: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center' }}>
          {mode === 'video' ? (
            <video
              src="/wingmic-explainer.mp4"
              autoPlay muted loop playsInline controls preload="auto"
              aria-label="wingmic product explainer"
              style={{ maxHeight: '100%', maxWidth: '100%', width: 'auto', borderRadius: 14, objectFit: 'contain', background: '#000' }}
            />
          ) : (
          <>
          {phase === 'idle' && (
            <>
              <div className="serif" style={{ fontStyle: 'italic', fontSize: 'clamp(20px, 2.3vw, 30px)', color: '#fff' }}>who did you just meet?</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', maxWidth: 320, lineHeight: 1.5 }}>tap the mic and say it out loud — like <span style={{ color: 'rgba(255,255,255,0.75)' }}>"met Sarah from Acme, she leads Rust…"</span></div>
              <BigMic recording={false} disabled={!asrReady} onClick={onMicClick} />
              {hint && <div className="mono" style={{ fontSize: 11.5, color: THIRD }}>{hint}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                {['speak', 'extract', 'recall'].map((s, i) => (
                  <span key={s} className="mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>{i + 1} · {s}</span>
                ))}
              </div>
            </>
          )}

          {(phase === 'recording' || phase === 'extracting') && (
            <>
              {recording && <Bars active />}
              <div className="mono" style={{ fontSize: 10, color: ACCENT, letterSpacing: 1, textTransform: 'uppercase' }}>{phase === 'extracting' ? 'transcribing' : 'recording'}</div>
              <div style={{ fontSize: 17, color: 'rgba(255,255,255,0.9)', lineHeight: 1.5, fontFamily: 'Instrument Serif, serif', fontStyle: 'italic', maxWidth: 360, minHeight: 52 }}>
                {phase === 'extracting'
                  ? (text || <span style={{ color: 'rgba(255,255,255,0.35)' }}>sending to wingmic…</span>)
                  : (live || <span style={{ color: 'rgba(255,255,255,0.35)' }}>{asr ? 'speak now — tap the mic when done' : 'listening… say who you met'}</span>)}
              </div>
              {recording && <BigMic recording onClick={onMicClick} />}
              {phase === 'extracting' && (
                <div className="mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT, animation: 'pulse-d 0.9s infinite' }} />building your graph…
                </div>
              )}
            </>
          )}

          {phase === 'result' && data && (
            <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left', overflow: 'auto' }}>
              {text && <div className="mono" style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.45 }}>"{text.length > 130 ? `${text.slice(0, 127)}…` : text}"</div>}
              <ContactCard data={data} />
              <div className="mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase' }}>graph</div>
              <MiniGraph data={data} />
              <WaitlistForm compact accent={ACCENT} source="wingmic.xyz/demo" />
              <button type="button" onClick={reset} className="mono" style={{ alignSelf: 'center', fontSize: 11, color: 'rgba(255,255,255,0.55)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>↺ try again</button>
            </div>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}

function MacBook() {
  const [mode, setMode] = useState('demo'); // demo | video
  return (
    <>
      <div className="wm-macBook" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* lid */}
        <div style={{ width: '100%', position: 'relative', background: '#0b0b0e', border: '2px solid #c8c8cf', borderRadius: '16px 16px 6px 6px', padding: 10, boxShadow: '0 34px 70px rgba(0,0,0,0.55)' }}>
          <div aria-hidden style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)', width: 5, height: 5, borderRadius: '50%', background: '#2a2a30' }} />
          <div style={{ position: 'relative', aspectRatio: '16 / 10', borderRadius: 3, overflow: 'hidden', background: '#08080d' }}>
            <DesktopDemo mode={mode} />
          </div>
        </div>
        {/* base / deck */}
        <div style={{ position: 'relative', width: '106%', height: 14, background: 'linear-gradient(#cfcfd6, #a6a6af)', borderRadius: '0 0 12px 12px', boxShadow: '0 12px 22px rgba(0,0,0,0.45)' }}>
          <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '15%', height: 6, borderRadius: '0 0 8px 8px', background: '#95959d' }} />
        </div>
      </div>
      {/* mode toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
        <div style={{ display: 'inline-flex', padding: 4, borderRadius: 999, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {[['video', '▶ explainer'], ['demo', '✨ try it live']].map(([m, label]) => (
            <button key={m} type="button" onClick={() => setMode(m)} style={{
              padding: '7px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
              background: mode === m ? ACCENT : 'transparent',
              color: mode === m ? '#000' : 'rgba(255,255,255,0.6)',
            }}>{label}</button>
          ))}
        </div>
      </div>
    </>
  );
}

// ─────────────────── responsive stage: iPhone on mobile, MacBook on desktop ───────────────────
export default function HeroStage() {
  const [desktop, setDesktop] = useState(null);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px)');
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  if (desktop === null) return <div className="wm-stage-skeleton" aria-hidden />;
  return desktop ? <MacBook /> : <HeroPhone width={420} />;
}

function HeroPhone({ width = 300 }) {
  const [mode, setMode] = useState('video');
  const videoRef = useRef(null);
  const micRef = useRef(null);

  useEffect(() => { videoRef.current?.play?.().catch(() => {}); }, [mode]);

  return (
    <div className="wm-heroPhone" style={{ width: '100%', maxWidth: width }}>
      <div className="wm-phoneBox" style={{ position: 'relative', width: '100%', aspectRatio: IPHONE_ASPECT, filter: 'drop-shadow(0 26px 50px rgba(0,0,0,0.55))' }}>
        <IphoneFrame style={{ zIndex: 0 }} />
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
            <DemoScreen micRef={micRef} />
          )}
        </div>
        <div aria-hidden style={{ position: 'absolute', zIndex: 2, top: '3.5%', left: '50%', transform: 'translateX(-50%)', width: '28.5%', height: '4.1%', background: '#08080c', borderRadius: 999, pointerEvents: 'none' }} />
      </div>
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
