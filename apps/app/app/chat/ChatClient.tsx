'use client';

// ChatClient — chat surface (PR β₁-D rewrite).
//
// Post-pivot: the recorder + pipeline state lives in the global
// CaptureProvider (mounted at the root layout). ChatClient is now a thin
// view: it seeds the thread from the server prefetch, then renders the
// header + thread + nav. The dock chrome (orb, lock circle, transcript
// card) lives in the BottomTabBar and the global RecordingOverlay.
//
// chat IS still the capture surface in the sense that completed memos
// land here — but recording itself can begin from any route (the orb in
// the bottom nav is global). On `recorder.ready`, the provider pushes
// /chat so the user sees the bubble + extraction in the thread.

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { useCapture } from '@/app/_components/CaptureProvider';
import { ChatHeader } from './_components/ChatHeader';
import { ChatThread, UndoChip } from './_components/ChatThread';
import { ChatEntityRail } from './_components/ChatEntityRail';
import { CameraCapture } from './_components/CameraCapture';
import { accent } from './_components/tokens';
import type { ChatInitialItem } from './_components/types';

interface ChatClientProps {
  userName: string | null;
  /** Server-prefetched, oldest-first list of past committed memos. Defaults to []. */
  initialThread?: ChatInitialItem[];
}

function ChatComposer() {
  const {
    recorder,
    submitText,
    openTarget,
    setOpenTarget,
    openEvent,
    setOpenEvent,
    pendingAttachment,
    attachmentBusy,
    attachmentError,
    photoBindChoices,
    attachFiles,
    clearAttachment,
    choosePhotoBind,
    choosePhotoUnassigned,
  } = useCapture();
  const [text, setText] = useState('');
  const [dropping, setDropping] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const hot =
    recorder.status === 'arming' ||
    recorder.status === 'recording' ||
    recorder.status === 'lock_armed' ||
    recorder.status === 'cancel_armed' ||
    recorder.status === 'locked';

  if (hot) return null;

  const micUnavailable = !recorder.supported;
  const placeholder = micUnavailable
    ? 'log a memo or ask — mic unavailable'
    : openTarget
      ? `add to ${openTarget.name.toLowerCase()} · or start a new memo`
      : 'log a memo or ask — "who was the rust person?"';

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if ((!trimmed && !pendingAttachment) || photoBindChoices || attachmentBusy) return;
    void submitText(trimmed);
    setText('');
  }

  function onDragOver(e: DragEvent) {
    if (![...e.dataTransfer.types].includes('Files')) return;
    e.preventDefault();
    setDropping(true);
  }

  function onDragLeave() {
    setDropping(false);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDropping(false);
    void attachFiles(e.dataTransfer.files);
  }

  return (
    <>
    {cameraOpen ? (
      <CameraCapture
        onCapture={(file) => {
          setCameraOpen(false);
          void attachFiles([file]);
        }}
        onCancel={() => setCameraOpen(false)}
      />
    ) : null}
    <form
      onSubmit={onSubmit}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-testid="chat-composer"
      className="chat-composer-shell"
      style={{ background: 'linear-gradient(180deg, rgba(10,10,10,0) 0%, var(--bg-page) 28%, var(--bg-page) 100%)' }}
    >
      {photoBindChoices && photoBindChoices.length > 1 ? (
        <div
          data-testid="photo-bind-picker"
          style={{
            marginBottom: 8,
            padding: 10,
            borderRadius: 12,
            border: `1px solid ${accent}66`,
            background: 'var(--bg-card)',
            pointerEvents: 'auto',
          }}
        >
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-55)', marginBottom: 8 }}>
            who is this photo for?
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {photoBindChoices.map((choice) => (
              <button
                key={choice.entityId}
                type="button"
                onClick={() => choosePhotoBind(choice)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: '1px solid var(--border-mid)',
                  background: 'transparent',
                  color: accent,
                  cursor: 'pointer',
                  font: '700 11px Inter, system-ui, sans-serif',
                }}
              >
                {choice.name}
              </button>
            ))}
            <button
              type="button"
              aria-label="leave photo unassigned"
              onClick={choosePhotoUnassigned}
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                border: '1px solid var(--border-mid)',
                background: 'transparent',
                color: 'var(--text-70)',
                cursor: 'pointer',
                font: '700 11px Inter, system-ui, sans-serif',
              }}
            >
              unassigned
            </button>
          </div>
        </div>
      ) : null}
      {attachmentError ? (
        <div
          role="alert"
          className="mono"
          style={{
            marginBottom: 8,
            color: 'var(--coral, #ff6b6b)',
            fontSize: 11,
            pointerEvents: 'auto',
          }}
        >
          {attachmentError}
        </div>
      ) : null}
      {openTarget ? (
        <div
          data-testid="open-capture-chip"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 8,
            padding: '6px 10px',
            borderRadius: 8,
            border: `1px solid ${accent}66`,
            background: `${accent}14`,
            pointerEvents: 'auto',
          }}
        >
          <span className="mono" style={{ fontSize: 11, color: accent, letterSpacing: 0.3 }}>
            adding to {openTarget.name.toLowerCase()}
          </span>
          <button
            type="button"
            aria-label="clear selected person"
            onClick={() => setOpenTarget(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-55)',
              cursor: 'pointer',
              font: '700 12px Inter, system-ui, sans-serif',
              minWidth: 28,
              minHeight: 28,
            }}
          >
            ×
          </button>
        </div>
      ) : null}
      {openEvent ? (
        <div
          data-testid="open-event-chip"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 8,
            padding: '6px 10px',
            borderRadius: 8,
            border: `1px solid ${accent}66`,
            background: `${accent}14`,
            pointerEvents: 'auto',
          }}
        >
          <span className="mono" style={{ fontSize: 11, color: accent, letterSpacing: 0.3 }}>
            {openEvent.name.toLowerCase()} · open
          </span>
          <button
            type="button"
            aria-label="clear open event"
            onClick={() => setOpenEvent(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-55)',
              cursor: 'pointer',
              font: '700 12px Inter, system-ui, sans-serif',
              minWidth: 28,
              minHeight: 28,
            }}
          >
            ×
          </button>
        </div>
      ) : null}
      {pendingAttachment ? (
        <div
          data-testid="composer-attachment-preview"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
            pointerEvents: 'auto',
          }}
        >
          {/* data-url preview; next/image does not take in-memory jpeg */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="attached photo"
            src={`data:image/jpeg;base64,${pendingAttachment.jpegBase64}`}
            style={{
              width: 44,
              height: 44,
              objectFit: 'cover',
              borderRadius: 8,
              border: '1px solid var(--border-mid)',
            }}
          />
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-55)', flex: 1 }}>
            {pendingAttachment.qrText ? 'qr ready' : 'photo ready'}
          </span>
          <button
            type="button"
            aria-label="remove photo"
            onClick={() => clearAttachment()}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-55)',
              cursor: 'pointer',
              font: '700 12px Inter, system-ui, sans-serif',
              minWidth: 28,
              minHeight: 28,
            }}
          >
            ×
          </button>
        </div>
      ) : null}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          borderRadius: 999,
          background: 'var(--bg-card)',
          border: dropping ? `1.5px solid ${accent}` : '1px solid var(--border-mid)',
          pointerEvents: 'auto',
        }}
      >
        <input
          ref={pinInputRef}
          type="file"
          accept="image/*"
          hidden
          data-testid="composer-pin-input"
          onChange={(e) => {
            void attachFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          data-testid="composer-attach-pin"
          aria-label="attach photo"
          onClick={() => pinInputRef.current?.click()}
          style={{
            minWidth: 44,
            minHeight: 44,
            padding: 0,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-55)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PinIcon />
        </button>
        <button
          type="button"
          data-testid="composer-attach-camera"
          aria-label="take photo"
          onClick={() => setCameraOpen(true)}
          style={{
            minWidth: 44,
            minHeight: 44,
            padding: 0,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-55)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CameraIcon />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label="chat composer"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: 'var(--ink)',
            fontSize: 16,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          className="mono"
          disabled={Boolean(photoBindChoices) || attachmentBusy}
          style={{
            padding: '6px 12px',
            borderRadius: 999,
            background: accent,
            border: '1.5px solid #000',
            boxShadow: '2px 2px 0 #000',
            fontSize: 11,
            fontWeight: 700,
            cursor: photoBindChoices || attachmentBusy ? 'default' : 'pointer',
            opacity: photoBindChoices || attachmentBusy ? 0.5 : 1,
          }}
        >
          commit →
        </button>
      </div>
    </form>
    </>
  );
}

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16 12v5.5a4 4 0 0 1-8 0V7a3 3 0 0 1 6 0v9.5a2 2 0 0 1-4 0V8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 8 9.2 6.2A1 1 0 0 1 10 6h4a1 1 0 0 1 .8.4L16 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export default function ChatClient({ userName, initialThread = [] }: ChatClientProps) {
  const { seedThreadOnce } = useCapture();
  // Seed once on first ChatClient mount in the session. The seed lives in
  // the provider and is guarded by a ref there — so re-mounts of /chat
  // (e.g. record on /home → push to /chat) merge-prepend the prefetch
  // without clobbering the in-flight bubble. The ref here is belt-and-
  // braces in case React StrictMode double-invokes the effect.
  const localSeededRef = useRef(false);
  useEffect(() => {
    if (localSeededRef.current) return;
    localSeededRef.current = true;
    seedThreadOnce(initialThread);
  }, [initialThread, seedThreadOnce]);

  return (
    // Desktop (≥1120px) splits into [thread | entity rail]; on mobile the
    // rail is display:none and the thread is the full-width column.
    <div className="surface-split">
      <main
        className="surface-primary"
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-page)',
          color: 'var(--ink)',
        }}
      >
        <ChatHeader userName={userName} />
        <ChatThread />
        <UndoChip />
        <ChatComposer />
      </main>
      <ChatEntityRail />
    </div>
  );
}
