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

import { useEffect, useRef } from 'react';
import { useCapture } from '@/app/_components/CaptureProvider';
import { BottomTabBar } from '@/app/_components/BottomTabBar';
import { ChatHeader } from './_components/ChatHeader';
import { ChatThread, UndoChip } from './_components/ChatThread';
import type { ChatInitialItem } from './_components/types';

interface ChatClientProps {
  userName: string | null;
  /** Server-prefetched, oldest-first list of past committed memos. Defaults to []. */
  initialThread?: ChatInitialItem[];
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
    <main
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
      <BottomTabBar active="capture" />
    </main>
  );
}
