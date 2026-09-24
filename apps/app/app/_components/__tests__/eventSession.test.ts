// State-machine tests for the app-wide current-event session (spec D1 UI,
// AC2/AC3). The reducer IS the machine — the provider only translates tRPC
// responses into 'response' actions and resolves pendingAutoBind. Driving
// the matrix here keeps every transition honest and cheap.

import { describe, it, expect } from 'vitest';
import {
  EVENT_SESSION_INITIAL,
  eventKey,
  reduceEventSession,
  type EventSessionEvent,
  type EventSessionState,
} from '../eventSession';

function evt(partial: Partial<EventSessionEvent> & { name: string }): EventSessionEvent {
  return {
    id: partial.id ?? null,
    name: partial.name,
    location: partial.location ?? null,
    url: partial.url ?? null,
    dateRangeStart: partial.dateRangeStart ?? null,
    dateRangeEnd: partial.dateRangeEnd ?? null,
    allDay: partial.allDay ?? false,
  };
}

const START = new Date('2026-09-24T10:00:00Z');
const END = new Date('2026-09-24T12:00:00Z');

const summit = evt({ name: 'NEXA summit', dateRangeStart: START, dateRangeEnd: END });
const summitBound = evt({ id: 'ev_summit', name: 'NEXA summit', dateRangeStart: START, dateRangeEnd: END });
const websummit = evt({ name: 'Web Summit', dateRangeStart: START, dateRangeEnd: END });
const websummitBound = evt({ id: 'ev_ws', name: 'Web Summit', dateRangeStart: START, dateRangeEnd: END });

function bound(event: EventSessionEvent, source: 'ics-auto' | 'picked' = 'ics-auto') {
  return { state: 'bound' as const, event, source };
}

function reduceAll(state: EventSessionState, ...actions: Parameters<typeof reduceEventSession>[1][]) {
  return actions.reduce(reduceEventSession, state);
}

describe('eventSession state machine', () => {
  it('stays loading until the first response, then none on an empty one', () => {
    expect(EVENT_SESSION_INITIAL.phase).toBe('loading');
    const next = reduceEventSession(EVENT_SESSION_INITIAL, { type: 'response', session: null, candidates: [] });
    expect(next.phase).toBe('none');
  });

  it('auto-binds a single ongoing match and stages the canonical-row bind', () => {
    const next = reduceEventSession(EVENT_SESSION_INITIAL, {
      type: 'response',
      session: bound(summit),
      candidates: [summit],
    });
    expect(next.phase).toBe('bound');
    expect(next.source).toBe('ics-auto');
    expect(next.event).toEqual(summit);
    // id-less wire event → provider must call events.bind to canonicalize.
    expect(next.pendingAutoBind).toEqual(summit);
  });

  it('does not stage a bind when the server already has a canonical row', () => {
    const next = reduceEventSession(EVENT_SESSION_INITIAL, {
      type: 'response',
      session: bound(summitBound),
      candidates: [summitBound],
    });
    expect(next.pendingAutoBind).toBeNull();
    expect(next.phase).toBe('bound');
  });

  it('keeps picked provenance when the poll returns the same event', () => {
    const picked = reduceAll(
      EVENT_SESSION_INITIAL,
      { type: 'response', session: { state: 'ambiguous', candidates: [summit, websummit] }, candidates: [summit, websummit] },
      { type: 'bindResolved', event: summitBound, source: 'picked' },
    );
    expect(picked.source).toBe('picked');

    const polled = reduceEventSession(picked, {
      type: 'response',
      session: bound(summitBound, 'ics-auto'),
      candidates: [summitBound],
    });
    expect(polled.source).toBe('picked');
    expect(polled.event).toEqual(summitBound);
  });

  it('binds from the picker with the canonical row', () => {
    const ambiguous = reduceEventSession(EVENT_SESSION_INITIAL, {
      type: 'response',
      session: { state: 'ambiguous', candidates: [summit, websummit] },
      candidates: [summit, websummit],
    });
    expect(ambiguous.phase).toBe('ambiguous');

    const boundPicked = reduceEventSession(ambiguous, { type: 'bindResolved', event: websummitBound, source: 'picked' });
    expect(boundPicked.phase).toBe('bound');
    expect(boundPicked.source).toBe('picked');
    expect(boundPicked.event).toEqual(websummitBound);
  });

  it('announces the left event when the bound one is replaced by an ics-auto match', () => {
    const boundSummit = reduceEventSession(EVENT_SESSION_INITIAL, {
      type: 'response',
      session: bound(summitBound),
      candidates: [summitBound],
    });
    const replaced = reduceEventSession(boundSummit, {
      type: 'response',
      session: bound(websummitBound),
      candidates: [websummitBound],
    });
    expect(replaced.phase).toBe('bound');
    expect(replaced.event).toEqual(websummitBound);
    expect(replaced.toast).toBe('left nexa summit');
  });

  it('expires the session when the window closes, with a quiet toast', () => {
    const boundSummit = reduceEventSession(EVENT_SESSION_INITIAL, {
      type: 'response',
      session: bound(summitBound),
      candidates: [summitBound],
    });
    const expired = reduceEventSession(boundSummit, { type: 'response', session: null, candidates: [] });
    expect(expired.phase).toBe('none');
    expect(expired.toast).toBe('left nexa summit');

    // The toast clears on its own action.
    expect(reduceEventSession(expired, { type: 'clearToast' }).toast).toBeNull();
  });

  it('keeps a commit-adopted session when polls return none — no false expiry', () => {
    const adopted = reduceEventSession(EVENT_SESSION_INITIAL, { type: 'adoptCommit', eventId: 'ev_talk', name: 'Lightning Talks' });
    expect(adopted.phase).toBe('bound');
    expect(adopted.source).toBe('commit');

    const polled = reduceEventSession(adopted, { type: 'response', session: null, candidates: [] });
    expect(polled.phase).toBe('bound');
    expect(polled.source).toBe('commit');
    expect(polled.toast).toBeNull();
  });

  it('lets an ics-auto match outrank a commit-adopted session', () => {
    const adopted = reduceEventSession(EVENT_SESSION_INITIAL, { type: 'adoptCommit', eventId: 'ev_talk', name: 'Lightning Talks' });
    const icsArrived = reduceEventSession(adopted, { type: 'response', session: bound(summitBound), candidates: [summitBound] });
    expect(icsArrived.source).toBe('ics-auto');
    expect(icsArrived.event).toEqual(summitBound);
  });

  it('ignores commit adoption when a session is already bound or ambiguous', () => {
    const boundSummit = reduceEventSession(EVENT_SESSION_INITIAL, {
      type: 'response',
      session: bound(summitBound),
      candidates: [summitBound],
    });
    expect(reduceEventSession(boundSummit, { type: 'adoptCommit', eventId: 'ev_talk', name: 'Lightning Talks' })).toBe(boundSummit);

    const ambiguous = reduceEventSession(EVENT_SESSION_INITIAL, {
      type: 'response',
      session: { state: 'ambiguous', candidates: [summit, websummit] },
      candidates: [summit, websummit],
    });
    expect(reduceEventSession(ambiguous, { type: 'adoptCommit', eventId: 'ev_talk', name: 'Lightning Talks' })).toBe(ambiguous);
  });

  it('unbinding suppresses re-bind for the same event while the window lasts', () => {
    const boundSummit = reduceEventSession(EVENT_SESSION_INITIAL, {
      type: 'response',
      session: bound(summit),
      candidates: [summit],
    });
    const unbound = reduceEventSession(boundSummit, { type: 'unbind' });
    expect(unbound.phase).toBe('none');
    expect(unbound.suppressed).toEqual([eventKey(summit)]);

    // Next poll: same event still ongoing — must NOT re-bind silently.
    const polled = reduceEventSession(unbound, { type: 'response', session: bound(summit), candidates: [summit] });
    expect(polled.phase).toBe('none');
    expect(polled.pendingAutoBind).toBeNull();
  });

  it('bindResolved honors an explicit unbind that raced the in-flight bind', () => {
    // Id-less ics-auto match: response optimistically shows bound and stages
    // the canonical-row bind; the user unbinds while that bind is in flight;
    // the resolution must not silently re-bind (review finding, High).
    const staged = reduceEventSession(EVENT_SESSION_INITIAL, {
      type: 'response',
      session: bound(summit), // id-less — the canonical row doesn't exist yet
      candidates: [summit],
    });
    expect(staged.pendingAutoBind).toEqual(summit);

    const unbound = reduceEventSession(staged, { type: 'unbind' });
    expect(unbound.phase).toBe('none');
    expect(unbound.suppressed).toEqual([eventKey(summit)]);

    const resolved = reduceEventSession(unbound, {
      type: 'bindResolved',
      event: summitBound,
      source: 'ics-auto',
    });
    expect(resolved.phase).toBe('none');
    expect(resolved.event).toBeNull();
    expect(resolved.suppressed).toEqual([eventKey(summit)]);
  });

  it('re-arms auto-bind after the suppressed event leaves the window', () => {
    const boundSummit = reduceEventSession(EVENT_SESSION_INITIAL, {
      type: 'response',
      session: bound(summit),
      candidates: [summit],
    });
    const unbound = reduceEventSession(boundSummit, { type: 'unbind' });
    const windowClosed = reduceEventSession(unbound, { type: 'response', session: null, candidates: [] });
    expect(windowClosed.suppressed).toEqual([]);

    // New window with the same event name — auto-bind returns.
    const again = reduceEventSession(windowClosed, { type: 'response', session: bound(summit), candidates: [summit] });
    expect(again.phase).toBe('bound');
    expect(again.pendingAutoBind).toEqual(summit);
  });

  it('picker dismissal suppresses every candidate until the window passes', () => {
    const ambiguous = reduceEventSession(EVENT_SESSION_INITIAL, {
      type: 'response',
      session: { state: 'ambiguous', candidates: [summit, websummit] },
      candidates: [summit, websummit],
    });
    const dismissed = reduceEventSession(ambiguous, { type: 'dismissAmbiguous' });
    expect(dismissed.phase).toBe('none');

    const polled = reduceEventSession(dismissed, {
      type: 'response',
      session: { state: 'ambiguous', candidates: [summit, websummit] },
      candidates: [summit, websummit],
    });
    expect(polled.phase).toBe('none');
  });

  it('re-opens ambiguity when a new candidate appears after dismissal', () => {
    const ambiguous = reduceEventSession(EVENT_SESSION_INITIAL, {
      type: 'response',
      session: { state: 'ambiguous', candidates: [summit, websummit] },
      candidates: [summit, websummit],
    });
    const dismissed = reduceEventSession(ambiguous, { type: 'dismissAmbiguous' });

    const third = evt({ name: 'RustConf', dateRangeStart: START, dateRangeEnd: END });
    const next = reduceEventSession(dismissed, {
      type: 'response',
      session: { state: 'ambiguous', candidates: [summit, websummit, third] },
      candidates: [summit, websummit, third],
    });
    expect(next.phase).toBe('ambiguous');
    // The live candidate list still carries all three — the picker shows
    // what's real; suppression only gates the auto-open.
    expect(next.candidates).toHaveLength(3);
  });

  it('keeps the binding when the bound event is still among ambiguous candidates', () => {
    const boundSummit = reduceEventSession(EVENT_SESSION_INITIAL, {
      type: 'response',
      session: bound(summitBound),
      candidates: [summitBound],
    });
    const grew = reduceEventSession(boundSummit, {
      type: 'response',
      session: { state: 'ambiguous', candidates: [summitBound, websummit] },
      candidates: [summitBound, websummit],
    });
    expect(grew.phase).toBe('bound');
    expect(grew.event).toEqual(summitBound);
    expect(grew.toast).toBeNull();
  });

  it('bind failure lands in an honest none with a toast, no silent retry', () => {
    const pending = reduceEventSession(EVENT_SESSION_INITIAL, {
      type: 'response',
      session: bound(summit),
      candidates: [summit],
    });
    const failed = reduceEventSession(pending, { type: 'bindFailed' });
    expect(failed.phase).toBe('none');
    expect(failed.pendingAutoBind).toBeNull();
    expect(failed.toast).toContain('try again');
  });

  it('a failed poll never expires an active binding', () => {
    const boundSummit = reduceEventSession(EVENT_SESSION_INITIAL, {
      type: 'response',
      session: bound(summitBound),
      candidates: [summitBound],
    });
    expect(reduceEventSession(boundSummit, { type: 'queryError' })).toBe(boundSummit);
  });

  it('a failed poll resolves only the loading phase into none', () => {
    const errored = reduceEventSession(EVENT_SESSION_INITIAL, { type: 'queryError' });
    expect(errored.phase).toBe('none');
  });
});
