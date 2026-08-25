'use client';

import { useEffect, useRef, useState } from 'react';
import { snapshotVideoToJpeg } from '@/lib/chat/captureCamera';
import { readQrFromVideo } from '@/lib/chat/readQr';
import { accent } from './tokens';

type Facing = 'environment' | 'user';

type QrConfirm = {
  file: File;
  qrText: string;
};

const QR_POLL_MS = 320;

function oppositeFacing(facing: Facing): Facing {
  switch (facing) {
    case 'environment':
      return 'user';
    case 'user':
      return 'environment';
    default: {
      const _never: never = facing;
      return _never;
    }
  }
}

export function CameraCapture({
  onCapture,
  onCancel,
}: {
  onCapture: (file: File, qrText?: string | null) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);
  const encodingRef = useRef(false);
  const confirmRef = useRef<QrConfirm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [encoding, setEncoding] = useState(false);
  const [facing, setFacing] = useState<Facing>('environment');
  const [canSwitch, setCanSwitch] = useState(false);
  const [confirm, setConfirm] = useState<QrConfirm | null>(null);

  useEffect(() => {
    confirmRef.current = confirm;
  }, [confirm]);

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
          video: { facingMode: { ideal: facing } },
        });
        if (cancelled) {
          stopStream(stream);
          return;
        }
        stopStream(streamRef.current);
        streamRef.current = stream;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        const devices = await navigator.mediaDevices.enumerateDevices?.();
        if (!cancelled) {
          const cameras = devices?.filter((device) => device.kind === 'videoinput') ?? [];
          setCanSwitch(cameras.length > 1);
        }
      } catch {
        if (cancelled) return;
        if (streamRef.current) return;
        setError('camera unavailable');
      }
    }

    void start();
    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
      if (video) video.srcObject = null;
    };
  }, [facing]);

  useEffect(() => {
    if (!ready || confirm || error) return;
    const liveVideo = videoRef.current;
    if (!liveVideo) return;
    let stopped = false;

    async function tick(live: HTMLVideoElement) {
      if (stopped || cancelledRef.current || encodingRef.current || confirmRef.current) return;
      const value = await readQrFromVideo(live);
      if (stopped || cancelledRef.current || confirmRef.current || !value) return;
      encodingRef.current = true;
      try {
        const file = await snapshotVideoToJpeg(live);
        if (stopped || cancelledRef.current) return;
        live.pause();
        const next = { file, qrText: value };
        confirmRef.current = next;
        setConfirm(next);
      } catch {
        if (!cancelledRef.current && !stopped) setError('couldnt take that photo');
      } finally {
        encodingRef.current = false;
      }
    }

    void tick(liveVideo);
    const id = window.setInterval(() => void tick(liveVideo), QR_POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [ready, confirm, error]);

  async function snap() {
    const video = videoRef.current;
    if (!video || !ready || encoding || confirm || encodingRef.current) return;
    encodingRef.current = true;
    setEncoding(true);
    try {
      const file = await snapshotVideoToJpeg(video);
      if (cancelledRef.current) return;
      stopStream(streamRef.current);
      streamRef.current = null;
      onCapture(file);
    } catch {
      if (!cancelledRef.current) setError('couldnt take that photo');
    } finally {
      encodingRef.current = false;
      if (!cancelledRef.current) setEncoding(false);
    }
  }

  function cancel() {
    cancelledRef.current = true;
    onCancel();
  }

  function retake() {
    confirmRef.current = null;
    setConfirm(null);
    void videoRef.current?.play();
  }

  function useQr() {
    if (!confirm || cancelledRef.current) return;
    stopStream(streamRef.current);
    streamRef.current = null;
    onCapture(confirm.file, confirm.qrText);
  }

  function flip() {
    if (confirm || encoding) return;
    setReady(false);
    setFacing((current) => oppositeFacing(current));
  }

  const snapDisabled = Boolean(error) || !ready || encoding || Boolean(confirm);

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
        data-testid="camera-video"
        autoPlay
        muted
        playsInline
        onCanPlay={() => setReady(true)}
        style={{
          flex: 1,
          width: '100%',
          objectFit: 'cover',
          background: '#000',
        }}
      />
      {confirm ? (
        <div
          data-testid="camera-qr-confirm"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 120,
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(0,0,0,0.78)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <p
            className="mono"
            style={{
              margin: '0 0 10px',
              fontSize: 11,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: 'var(--text-55, #aaa)',
            }}
          >
            qr ready
          </p>
          <p
            data-testid="camera-qr-value"
            className="mono"
            style={{
              margin: '0 0 12px',
              fontSize: 13,
              color: 'var(--ink, #f4f1ea)',
              wordBreak: 'break-all',
              lineHeight: 1.4,
            }}
          >
            {confirm.qrText}
          </p>
          <button
            type="button"
            onClick={retake}
            className="mono"
            style={{
              minHeight: 44,
              padding: '0 12px',
              background: 'transparent',
              border: '1px solid var(--border-mid, rgba(255,255,255,0.16))',
              borderRadius: 10,
              color: 'var(--text-85, #ddd)',
              fontSize: 12,
              letterSpacing: 1,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            retake
          </button>
        </div>
      ) : null}
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
          onClick={cancel}
          className="mono"
          style={{
            minHeight: 44,
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
          disabled={snapDisabled}
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: `3px solid ${accent}`,
            background: accent,
            boxShadow: '4px 4px 0 #000',
            cursor: snapDisabled ? 'default' : 'pointer',
            opacity: snapDisabled ? 0.4 : 1,
          }}
        />
        {confirm ? (
          <button
            type="button"
            onClick={useQr}
            className="mono"
            style={{
              minHeight: 44,
              minWidth: 64,
              background: 'transparent',
              border: 'none',
              color: accent,
              fontSize: 13,
              letterSpacing: 1,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            use this
          </button>
        ) : canSwitch ? (
          <button
            type="button"
            aria-label="switch camera"
            onClick={flip}
            className="mono"
            style={{
              minHeight: 44,
              minWidth: 64,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-85, #ddd)',
              fontSize: 13,
              letterSpacing: 1,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            flip
          </button>
        ) : (
          <span style={{ width: 64 }} />
        )}
      </div>
    </div>
  );
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}
