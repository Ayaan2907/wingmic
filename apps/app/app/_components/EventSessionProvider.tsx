'use client';

// EventSessionProvider — the app-wide current-event session (spec D1 UI).
//
// Consumes events.current / events.bind (PR #176's server) and turns the
// wire contract into a UI state machine (eventSession.ts): silent auto-bind
// on exactly one ongoing match, a one-tap picker on several, an honest
// "not at an event" affordance on zero, and expiry auto-clear with a quiet
// toast when the window closes.
//
// Mounted in layout.tsx ABOVE CaptureProvider — both consume the session
// (the chip reads it; the capture pipeline reads the bound event id and
// adopts commit-derived events into it). Resolution runs on mount, on
// route change, and on a 60s poll; the server caches the ICS feed for 10
// minutes, so each poll is a cheap DB read + window match, not a fetch.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { usePathname } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import {
  EVENT_SESSION_INITIAL,
  eventKey,
  reduceEventSession,
  type EventSessionEvent,
  type EventSessionState,
} from './eventSession';

/** Routes that own their full viewport — no session resolution there. */
export const CHROMELESS_ROUTES = ['/signin', '/onboarding'];

export interface EventSessionContextValue {
  state: EventSessionState;
  /** Bind a candidate (picker) — resolves the canonical row via events.bind. */
  bind: (event: EventSessionEvent, source: 'picked') => Promise<void>;
  /** Drop the current binding and suppress its re-bind until the window passes. */
  unbind: () => void;
  /** Dismiss the ambiguous picker — none until the next window match. */
  dismissAmbiguous: () => void;
  /**
   * Transcript fallback: adopt an event a committed memo produced, but only
   * into silence — an ICS-bound or picked session outranks the transcript.
   */
  adoptCommitEvent: (event: { eventId: string; name: string }) => void;
}

const EventSessionContext = createContext<EventSessionContextValue | null>(null);

/**
 * Safe default when no provider is mounted (isolated component tests) —
 * mirrors useCapture's no-op bag: phase stays loading, chip renders nothing.
 */
const NOOP_VALUE: EventSessionContextValue = {
  state: EVENT_SESSION_INITIAL,
  bind: async () => {},
  unbind: () => {},
  dismissAmbiguous: () => {},
  adoptCommitEvent: () => {},
};

export function useEventSession(): EventSessionContextValue {
  return useContext(EventSessionContext) ?? NOOP_VALUE;
}

/** Poll cadence for expiry detection — the 10-min ICS cache makes this cheap. */
const SESSION_POLL_MS = 60_000;
const TOAST_MS = 4_500;

export function EventSessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const chromeless = pathname ? CHROMELESS_ROUTES.some((p) => pathname.startsWith(p)) : false;

  const [state, dispatch] = useReducer(reduceEventSession, EVENT_SESSION_INITIAL);

  const current = trpc.events.current.useQuery(undefined, {
    enabled: !chromeless,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
    retry: false,
  });
  const bindMutation = trpc.events.bind.useMutation();

  // Server response → machine. The effect keys on response identity (one
  // dispatch per fetch); the reducer owns every transition.
  const responseData = current.data;
  useEffect(() => {
    if (!responseData) return;
    dispatch({ type: 'response', session: responseData.session, candidates: responseData.candidates });
  }, [responseData]);

  // A query error (sign-out, transient 5xx) must not expire an active
  // binding — only resolve a still-loading session into an honest none.
  const queryError = current.isError;
  useEffect(() => {
    if (queryError) dispatch({ type: 'queryError' });
  }, [queryError]);

  // Resolve on route change — the session is global, and the hallway move
  // (chat → home → settings) must never drop it. The mount run is skipped:
  // useQuery has already started the identical fetch, and refetching it
  // would cancel and reissue the request.
  const lastPathnameRef = useRef(pathname);
  useEffect(() => {
    if (chromeless) return;
    if (lastPathnameRef.current === pathname) return;
    lastPathnameRef.current = pathname;
    current.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, chromeless]);

  // Poll for window expiry while idle.
  useEffect(() => {
    if (chromeless) return;
    const t = setInterval(() => current.refetch(), SESSION_POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chromeless]);

  // Auto-bind: the machine surfaced a canonical-id-less ics-auto event.
  // One bind in flight at a time; re-entry while pending is a no-op.
  const pendingAutoBind = state.pendingAutoBind;
  const bindInFlightRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingAutoBind) return;
    const key = eventKey(pendingAutoBind);
    if (bindInFlightRef.current === key) return;
    bindInFlightRef.current = key;
    bindMutation
      .mutateAsync({ event: pendingAutoBind, source: 'ics-auto' })
      .then((res) => {
        dispatch({ type: 'bindResolved', event: res.session.event, source: 'ics-auto' });
      })
      .catch(() => {
        // Visible, not silent: honest none + toast; the next poll re-derives.
        dispatch({ type: 'bindFailed' });
      })
      .finally(() => {
        bindInFlightRef.current = null;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutoBind]);

  // Quiet toasts clear themselves.
  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: 'clearToast' }), TOAST_MS);
    return () => clearTimeout(t);
  }, [state.toast]);

  const bind = useCallback(
    async (event: EventSessionEvent, source: 'picked') => {
      try {
        const res = await bindMutation.mutateAsync({ event, source });
        dispatch({ type: 'bindResolved', event: res.session.event, source });
      } catch {
        dispatch({ type: 'bindFailed' });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const unbind = useCallback(() => dispatch({ type: 'unbind' }), []);
  const dismissAmbiguous = useCallback(() => dispatch({ type: 'dismissAmbiguous' }), []);
  const adoptCommitEvent = useCallback(
    (event: { eventId: string; name: string }) =>
      dispatch({ type: 'adoptCommit', eventId: event.eventId, name: event.name }),
    [],
  );

  const value = useMemo<EventSessionContextValue>(
    () => ({ state, bind, unbind, dismissAmbiguous, adoptCommitEvent }),
    [state, bind, unbind, dismissAmbiguous, adoptCommitEvent],
  );

  return <EventSessionContext.Provider value={value}>{children}</EventSessionContext.Provider>;
}
