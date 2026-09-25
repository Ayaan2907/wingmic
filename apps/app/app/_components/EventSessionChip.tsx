'use client';

// EventSessionChip — the global surface of the current-event session (D1 UI).
// Rendered once in AppShell on every chrome'd page, replacing the chat-local
// chip (R §3): the session now survives leaving /chat.
//
// Per-state honesty:
//   bound      → amber chip "at <event>" — tap reviews/unbinds
//   ambiguous  → "which event is this?" chip + one-time bottom-sheet picker
//   none + ICS → dashed ghost "not at an event · pick one" (opens picker)
//   none + no ICS → nothing (the settings nudge already owns that story)
//   expiry     → quiet "left <event>" toast, auto-dismissed
//
// Design system v3 (relaxed premium): mono chrome text, single amber accent,
// one serif italic word in the picker title, 44px option rows, soft layered
// overlay shadow on the sheet — no hard offsets anywhere.

import * as React from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { shadows, radii, motion } from '@wingmic/design-tokens';
import { useEventSession } from './EventSessionProvider';
import { eventKey, type EventSessionEvent } from './eventSession';

type SheetKind = 'none' | 'picker' | 'review';

function timeHint(event: EventSessionEvent): string {
  if (event.allDay) return 'all day';
  if (!event.dateRangeStart) return '';
  const start = event.dateRangeStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (!event.dateRangeEnd) return start;
  const end = event.dateRangeEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${start} – ${end}`;
}

const PROVENANCE: Record<string, string> = {
  'ics-auto': 'from your calendar',
  picked: 'picked by you',
  commit: 'from your memo',
};

export function EventSessionChip() {
  const { state, bind, unbind, dismissAmbiguous } = useEventSession();
  // Same cached query AppShell already holds (staleTime 5min) — the ghost
  // affordance only makes sense when a calendar exists to be picked from.
  const settings = trpc.settings.get.useQuery(undefined, {
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const icsSet = Boolean(settings.data?.calendarIcsUrl);

  const [sheet, setSheet] = React.useState<SheetKind>('none');
  // The ambiguous picker auto-opens once per ambiguity episode — dismissing
  // it must not re-open it on the next 60s poll (the reducer keeps us in
  // `none` while every candidate stays suppressed).
  const askedRef = React.useRef(false);
  React.useEffect(() => {
    if (state.phase === 'ambiguous') {
      if (!askedRef.current) {
        askedRef.current = true;
        setSheet('picker');
      }
    } else {
      askedRef.current = false;
    }
  }, [state.phase]);

  const closeSheets = React.useCallback(() => setSheet('none'), []);

  const onPick = React.useCallback(
    (event: EventSessionEvent) => {
      setSheet('none');
      void bind(event, 'picked');
    },
    [bind],
  );

  const onUnbind = React.useCallback(() => {
    setSheet('none');
    unbind();
  }, [unbind]);

  // Loading / none-without-ICS / chromeless-safe default → render nothing.
  if (state.phase === 'loading') return null;
  if (state.phase === 'none' && !icsSet) return null;

  const ghost = state.phase === 'none';

  return (
    <>
      {ghost ? (
        <button
          type="button"
          data-testid="event-session-ghost"
          onClick={() => setSheet('picker')}
          aria-label="not at an event — pick one"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: '12px auto 0',
            padding: '10px 14px',
            borderRadius: 999,
            border: '1.5px dashed var(--border-mid)',
            background: 'transparent',
            color: 'var(--text-55)',
            cursor: 'pointer',
            minHeight: 40,
            font: '600 12px Inter, system-ui, sans-serif',
          }}
        >
          <span className="mono" style={{ fontSize: 11, letterSpacing: 0.4 }}>
            not at an event · pick one
          </span>
        </button>
      ) : (
        <button
          type="button"
          data-testid="event-session-chip"
          onClick={() => setSheet(state.phase === 'ambiguous' ? 'picker' : 'review')}
          aria-label={
            state.phase === 'ambiguous' ? 'which event is this — pick one' : 'review current event'
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: '12px auto 0',
            padding: '10px 14px',
            borderRadius: radii.pill,
            border: '1px solid var(--border-acc)',
            background: 'rgba(255,196,82,0.08)',
            color: 'var(--text-85)',
            boxShadow: shadows.contact,
            transition: `box-shadow ${motion.duration.fast} ${motion.ease.out}, border-color ${motion.duration.fast} ${motion.ease.out}`,
            cursor: 'pointer',
            minHeight: 40,
            font: '600 12px Inter, system-ui, sans-serif',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: 'var(--accent)',
              flexShrink: 0,
            }}
          />
          <span className="mono" style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: 0.4 }}>
            {state.phase === 'ambiguous' ? (
              'which event is this?'
            ) : (
              <>
                at{' '}
                <span className="serif" style={{ fontStyle: 'italic', fontSize: 12.5 }}>
                  {state.event?.name.toLowerCase()}
                </span>
              </>
            )}
          </span>
        </button>
      )}

      {sheet === 'picker' ? (
        <EventSessionPicker
          candidates={state.candidates}
          onPick={onPick}
          onDismiss={() => {
            dismissAmbiguous();
            closeSheets();
          }}
          onClose={closeSheets}
        />
      ) : null}

      {sheet === 'review' && state.phase === 'bound' && state.event ? (
        <EventSessionReview
          event={state.event}
          source={state.source ?? 'picked'}
          onUnbind={onUnbind}
          onClose={closeSheets}
        />
      ) : null}

      {state.toast ? (
        <div
          data-testid="event-session-toast"
          role="status"
          className="mono"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 'calc(var(--chat-composer-bottom, 72px) + 64px)',
            transform: 'translateX(-50%)',
            padding: '8px 14px',
            background: 'var(--bg-raised)',
            border: '1px solid var(--border-mid)',
            borderRadius: radii.pill,
            color: 'var(--text-70)',
            fontSize: 11,
            zIndex: 60,
            whiteSpace: 'nowrap',
            boxShadow: shadows.raised,
          }}
        >
          {state.toast}
        </div>
      ) : null}
    </>
  );
}

function SheetFrame({
  testId,
  label,
  children,
  onDismiss,
}: {
  testId: string;
  label: string;
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  const sheetRef = React.useRef<HTMLDivElement | null>(null);

  // Latest-dispatcher ref: the keydown/focus setup below runs exactly once per
  // mount. Re-subscribing per render (deps on onDismiss) would bounce focus
  // back to the sheet on every background re-render — a keyboard user tabbing
  // through the sheet's actions loses their position on the next poll.
  const onDismissRef = React.useRef(onDismiss);
  React.useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  // Modal semantics need the behavior to match: Escape dismisses, focus moves
  // into the sheet on mount and returns where it came from on unmount.
  React.useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismissRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
    // Mount-only: the effect owns the listener + focus lifecycle once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onDismiss}
        style={{ position: 'fixed', inset: 0, zIndex: 69, background: 'rgba(0,0,0,0.45)' }}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-testid={testId}
        tabIndex={-1}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 70,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            width: '100%',
            maxWidth: 480,
            margin: '0 12px calc(env(safe-area-inset-bottom, 0px) + 84px)',
            background: 'var(--bg-raised)',
            border: '1px solid var(--border-soft)',
            borderRadius: radii.xl,
            // Sheet — v3 layered overlay shadow.
            boxShadow: shadows.overlay,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}

function EventSessionPicker({
  candidates,
  onPick,
  onDismiss,
  onClose,
}: {
  candidates: EventSessionEvent[];
  onPick: (event: EventSessionEvent) => void;
  onDismiss: () => void;
  onClose: () => void;
}) {
  return (
    <SheetFrame testId="event-session-picker" label="which event are you at?" onDismiss={onClose}>
      <div style={{ fontSize: 15, color: 'var(--text-85)' }}>
        which{' '}
        <span className="serif" style={{ fontStyle: 'italic', fontSize: 16.5 }}>
          one
        </span>{' '}
        are you at?
      </div>
      {candidates.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '6px 0 2px' }}>
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-55)' }}>
            nothing on the calendar right now.
          </div>
          <Link
            href="/settings#calendars"
            data-testid="event-session-picker-empty-settings"
            style={{
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              border: '1px solid var(--border-mid)',
              color: 'var(--text-85)',
              textDecoration: 'none',
              font: '600 13px Inter, system-ui, sans-serif',
            }}
          >
            add a calendar in settings →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {candidates.map((event) => (
            <button
              key={eventKey(event)}
              type="button"
              data-testid="event-session-option"
              onClick={() => onPick(event)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                minHeight: 44,
                padding: '10px 14px',
                borderRadius: radii.sm,
                background: 'var(--surface-1)',
                border: '1px solid var(--border-soft)',
                color: 'var(--text-85)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: `border-color ${motion.duration.fast} ${motion.ease.out}`,
                font: '600 13.5px Inter, system-ui, sans-serif',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {event.name.toLowerCase()}
              </span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--text-40)', flexShrink: 0 }}>
                {timeHint(event)}
              </span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onDismiss}
        style={{
          minHeight: 44,
          borderRadius: 10,
          background: 'transparent',
          border: '1px solid var(--border-mid)',
          color: 'var(--text-55)',
          cursor: 'pointer',
          font: '600 12.5px Inter, system-ui, sans-serif',
        }}
      >
        not at any of these
      </button>
    </SheetFrame>
  );
}

function EventSessionReview({
  event,
  source,
  onUnbind,
  onClose,
}: {
  event: EventSessionEvent;
  source: string;
  onUnbind: () => void;
  onClose: () => void;
}) {
  return (
    <SheetFrame testId="event-session-review" label="current event" onDismiss={onClose}>
      <div style={{ fontSize: 16, color: 'var(--text-100)' }}>
        at{' '}
        <span className="serif" style={{ fontStyle: 'italic', fontSize: 17.5 }}>
          {event.name.toLowerCase()}
        </span>
      </div>
      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-40)' }}>
        {[PROVENANCE[source] ?? 'picked', timeHint(event)].filter(Boolean).join(' · ')}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {event.id ? (
          <Link
            href={`/event/${event.id}`}
            style={{
              flex: 1,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radii.md,
              background: 'var(--accent)',
              color: '#000',
              border: 'none',
              // Button — v3 soft elevation, lifts on press.
              boxShadow: shadows.button,
              transition: `box-shadow ${motion.duration.fast} ${motion.ease.out}`,
              textDecoration: 'none',
              font: '700 12.5px Inter, system-ui, sans-serif',
            }}
          >
            open event →
          </Link>
        ) : null}
        <button
          type="button"
          data-testid="event-session-unbind"
          onClick={onUnbind}
          style={{
            flex: 1,
            minHeight: 44,
            borderRadius: 10,
            background: 'transparent',
            border: '1px solid rgba(255,107,107,0.4)',
            color: 'var(--alarm)',
            cursor: 'pointer',
            font: '600 12.5px Inter, system-ui, sans-serif',
          }}
        >
          unbind
        </button>
      </div>
    </SheetFrame>
  );
}
