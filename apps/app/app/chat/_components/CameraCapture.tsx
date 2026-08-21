'use client';

import { useEffect, useRef, useState } from 'react';
import { snapshotVideoToJpeg } from '@/lib/chat/captureCamera';
import { accent } from './tokens';

export function CameraCapture({
  onCapture,
  onCancel,
}: {
  onCapture: (file: File) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('camera unavailable');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        });
        if (cancelled) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
      } catch {
        if (!cancelled) setError('camera unavailable');
      }
    }

    void start();
    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
      if (video) video.srcObject = null;
    };
  }, []);

  async function snap() {
    const video = videoRef.current;
    if (!video) return;
    try {
      const file = await snapshotVideoToJpeg(video);
      stopStream(streamRef.current);
      streamRef.current = null;
      onCapture(file);
    } catch {
      setError('couldnt take that photo');
    }
  }

  return (
    <div
      data-testid="camera-preview"
      role="dialog"
      aria-label="camera"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          flex: 1,
          width: '100%',
          objectFit: 'cover',
          background: '#000',
        }}
      />
      {error ? (
        <p
          role="alert"
          className="mono"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: 0,
            color: accent,
            fontSize: 13,
            letterSpacing: 1,
          }}
        >
          {error}
        </p>
      ) : null}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px calc(20px + env(safe-area-inset-bottom))',
          background: 'rgba(0,0,0,0.72)',
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          className="mono"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-85, #ddd)',
            fontSize: 13,
            letterSpacing: 1,
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          cancel
        </button>
        <button
          type="button"
          aria-label="snap"
          onClick={() => void snap()}
          disabled={Boolean(error)}
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: `3px solid ${accent}`,
            background: accent,
            boxShadow: '4px 4px 0 #000',
            cursor: error ? 'default' : 'pointer',
            opacity: error ? 0.4 : 1,
          }}
        />
        <span style={{ width: 64 }} />
      </div>
    </div>
  );
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}
