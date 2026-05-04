'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string; confidence: number };
    length: number;
  }>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export type RecognitionStatus = 'idle' | 'starting' | 'listening' | 'stopped' | 'error';

interface UseSpeechRecognition {
  status: RecognitionStatus;
  finalTranscript: string;
  interimTranscript: string;
  error: string | null;
  supported: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useSpeechRecognition(lang = 'en-US'): UseSpeechRecognition {
  const [status, setStatus] = useState<RecognitionStatus>('idle');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      setError('this browser does not support voice capture. type instead.');
      return;
    }

    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = lang;

    r.onstart = () => {
      setStatus('listening');
      setError(null);
    };

    r.onresult = (event) => {
      let interim = '';
      let nextFinal = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) nextFinal += text + ' ';
        else interim += text;
      }
      if (nextFinal) {
        setFinalTranscript((prev) => (prev + nextFinal).trim() + ' ');
      }
      setInterimTranscript(interim);
    };

    r.onerror = (event) => {
      const code = event.error;
      if (code === 'no-speech') return; // Chrome fires this routinely; ignore.
      const msg =
        code === 'not-allowed'
          ? 'microphone permission denied. allow it in your browser settings.'
          : code === 'audio-capture'
            ? 'no microphone detected.'
            : code === 'network'
              ? 'network error during transcription.'
              : `recognition error: ${code}`;
      setError(msg);
      setStatus('error');
    };

    r.onend = () => {
      setInterimTranscript('');
      setStatus((s) => (s === 'listening' ? 'stopped' : s));
    };

    recognitionRef.current = r;
    return () => {
      try {
        r.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const r = recognitionRef.current;
    if (!r) return;
    setError(null);
    setStatus('starting');
    try {
      r.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to start');
      setStatus('error');
    }
  }, []);

  const stop = useCallback(() => {
    const r = recognitionRef.current;
    if (!r) return;
    try {
      r.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const reset = useCallback(() => {
    setFinalTranscript('');
    setInterimTranscript('');
    setError(null);
    setStatus('idle');
  }, []);

  return { status, finalTranscript, interimTranscript, error, supported, start, stop, reset };
}
