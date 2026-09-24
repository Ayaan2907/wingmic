// eventSession — the pure state machine behind the app-wide current-event
// session (spec D1 UI). No React, no tRPC: the provider dispatches actions
// and renders the result, tests drive the reducer directly.
//
// Sources of truth, in precedence order:
//   1. ICS auto-bind  (events.current says exactly one ongoing match)
//   2. picker bind    (user picked from the ambiguous/none affordance)
//   3. commit adopt   (transcript-derived fallback — only when 1 and 2
//                      gave nothing; spec Move 1 keeps this layer alive)
//
// The wire types mirror apps/app/lib/trpc/routers/events.ts; the client
// source union adds 'commit' for adopted memo events, which never travel
// back over the wire (they already have canonical ids from the commit).

export type EventSessionEvent = {
  /** Canonical event row id — null until events.bind lazily creates/reuses it. */
  id: string | null;
  name: string;
  location: string | null;
  url: string | null;
  dateRangeStart: Date | null;
  dateRangeEnd: Date | null;
  allDay: boolean;
};

export type SessionSource = 'ics-auto' | 'picked' | 'commit';

export interface EventSessionState {
  phase: 'loading' | 'none' | 'bound' | 'ambiguous';
  event: EventSessionEvent | null;
  source: SessionSource | null;
  /** Ongoing + upcoming candidates from the last events.current response. */
  candidates: EventSessionEvent[];
  /**
   * An ics-auto event waiting for its canonical row — the provider calls
   * events.bind and resolves it with bindResolved. Kept in state so the
   * trigger is part of the tested machine, not a provider effect quirk.
   */
  pendingAutoBind: EventSessionEvent | null;
  /**
   * Event keys the user explicitly dismissed (unbind / picker dismiss).
   * Suppression lasts while the event stays in the calendar window —
   * unbinding an ics-auto session must not be silently undone 60s later
   * by the next poll.
   */
  suppressed: string[];
  /** One quiet toast at a time; the provider clears it on a timer. */
  toast: string | null;
}

/**
 * The `session` member of the events.current response, structurally —
 * kept local so the machine file never imports server modules. 'none'
 * arrives both as null (no ICS) and as an explicit state (no window match).
 */
export type WireSession =
  | { state: 'none' }
  | { state: 'bound'; event: EventSessionEvent; source: 'ics-auto' | 'picked' }
  | { state: 'ambiguous'; candidates: EventSessionEvent[] };

export type EventSessionAction =
  | { type: 'response'; session: WireSession | null; candidates: EventSessionEvent[] }
  | { type: 'bindResolved'; event: EventSessionEvent; source: 'ics-auto' | 'picked' }
  | { type: 'bindFailed' }
  | { type: 'unbind' }
  | { type: 'dismissAmbiguous' }
  | { type: 'adoptCommit'; eventId: string; name: string }
  | { type: 'clearToast' }
  | { type: 'queryError' };

export const EVENT_SESSION_INITIAL: EventSessionState = {
  phase: 'loading',
  event: null,
  source: null,
  candidates: [],
  pendingAutoBind: null,
  suppressed: [],
  toast: null,
};

/** Stable identity for suppression + same-event checks across polls. */
export function eventKey(event: EventSessionEvent): string {
  return `${event.name.trim().toLowerCase()}|${event.dateRangeStart?.toISOString() ?? ''}`;
}

function commitEvent(eventId: string, name: string): EventSessionEvent {
  return {
    id: eventId,
    name,
    location: null,
    url: null,
    dateRangeStart: null,
    dateRangeEnd: null,
    allDay: false,
  };
}

/**
 * Expire a window-bound session (ics-auto / picked): the calendar window
 * closed or the server stopped matching it. Commit-adopted sessions have
 * no window — they persist until replaced or unbound, so a poll that
 * returns null never falsifies a "left <event>" toast for them.
 */
function expireIfNeeded(
  state: EventSessionState,
  session: WireSession | null,
): { toast: string | null; clearBound: boolean } {
  if (state.phase !== 'bound' || state.source === 'commit') {
    return { toast: null, clearBound: false };
  }
  const hasWindow = session !== null && session.state !== 'none';
  const expired =
    !hasWindow ||
    (session.state === 'bound' && eventKey(session.event) !== eventKey(state.event!)) ||
    (session.state === 'ambiguous' && !session.candidates.some((c) => eventKey(c) === eventKey(state.event!)));
  if (!expired) return { toast: null, clearBound: false };
  return { toast: `left ${state.event!.name.toLowerCase()}`, clearBound: true };
}

export function reduceEventSession(
  state: EventSessionState,
  action: EventSessionAction,
): EventSessionState {
  switch (action.type) {
    case 'response': {
      const candidates = action.candidates;
      // Suppression only lives while its event is still on the calendar — once
      // the window passes (event leaves candidates) a later window match may
      // auto-bind again, per the spec's "none until next match".
      const suppressed = state.suppressed.filter((key) =>
        candidates.some((c) => eventKey(c) === key),
      );
      const base: EventSessionState = { ...state, candidates, suppressed };

      if (action.session?.state === 'bound') {
        const incoming = action.session.event;
        const key = eventKey(incoming);
        if (state.phase === 'bound' && state.event && eventKey(state.event) === key) {
          // Same event — keep current provenance and canonical id, no churn.
          return { ...base, pendingAutoBind: null };
        }
        if (suppressed.includes(key)) {
          // User unbound this exact event this window — stay none.
          return { ...base, phase: 'none', event: null, source: null, pendingAutoBind: null };
        }
        const expiry = expireIfNeeded(state, action.session);
        return {
          ...base,
          phase: 'bound',
          event: incoming,
          source: 'ics-auto',
          pendingAutoBind: incoming.id ? null : incoming,
          toast: expiry.toast,
        };
      }

      if (action.session?.state === 'ambiguous') {
        const expiry = expireIfNeeded(state, action.session);
        const live = action.session.candidates.filter(
          (c) => !suppressed.includes(eventKey(c)),
        );
        if (state.phase === 'bound' && !expiry.clearBound) {
          // Our event is still among the ongoing candidates — the overlap
          // grew around it; keep the binding, expose candidates for review.
          return { ...base, toast: null };
        }
        if (live.length === 0) {
          // Everything ambiguous was dismissed already — honest none.
          return { ...base, phase: 'none', event: null, source: null, pendingAutoBind: null, toast: expiry.toast };
        }
        return {
          ...base,
          phase: 'ambiguous',
          event: null,
          source: null,
          pendingAutoBind: null,
          toast: expiry.toast,
        };
      }

      // session: null — no ICS or zero window matches.
      const expiry = expireIfNeeded(state, null);
      if (state.phase === 'bound' && !expiry.clearBound) {
        // Commit-adopted session has no window; keep it.
        return { ...base, toast: null };
      }
      return {
        ...base,
        phase: 'none',
        event: null,
        source: null,
        pendingAutoBind: null,
        toast: expiry.toast,
      };
    }

    case 'bindResolved': {
      // An explicit unbind wins the race against an in-flight ics-auto bind:
      // the suppression contract forbids silently re-binding the event the
      // user just dismissed. (Picker-driven picks can't hit this — the option
      // list already filters suppressed candidates.)
      if (state.suppressed.includes(eventKey(action.event))) {
        return { ...state, pendingAutoBind: null, toast: null };
      }
      return {
        ...state,
        phase: 'bound',
        event: action.event,
        source: action.source,
        pendingAutoBind: null,
        toast: null,
      };
    }

    case 'bindFailed':
      // Honest failure: no silent retry loop — the next poll re-derives,
      // and the picker can be retried by hand.
      return {
        ...state,
        phase: 'none',
        event: null,
        source: null,
        pendingAutoBind: null,
        toast: 'couldn’t bind that event. try again.',
      };

    case 'unbind':
      return state.event
        ? {
            ...state,
            phase: 'none',
            event: null,
            source: null,
            pendingAutoBind: null,
            toast: null,
            suppressed: [...state.suppressed, eventKey(state.event)],
          }
        : state;

    case 'dismissAmbiguous':
      return {
        ...state,
        phase: 'none',
        event: null,
        source: null,
        pendingAutoBind: null,
        toast: null,
        suppressed: [
          ...state.suppressed,
          ...state.candidates.filter((c) => !state.suppressed.includes(eventKey(c))).map(eventKey),
        ],
      };

    case 'adoptCommit':
      // Transcript fallback: only fills silence. An ICS-bound or picked
      // session outranks anything the memo mentioned (spec Move 1). 'loading'
      // counts as silence — seed adoption fires on mount, before the first
      // events.current response lands, and that response then outranks it.
      if (state.phase !== 'none' && state.phase !== 'loading') return state;
      return {
        ...state,
        phase: 'bound',
        event: commitEvent(action.eventId, action.name),
        source: 'commit',
        pendingAutoBind: null,
        toast: null,
      };

    case 'clearToast':
      return state.toast ? { ...state, toast: null } : state;

    case 'queryError':
      // A failed poll must never expire an active binding (transient 5xx,
      // sign-out) — it only resolves a still-loading session into none.
      return state.phase === 'loading' ? { ...state, phase: 'none' } : state;

    default:
      return state;
  }
}
