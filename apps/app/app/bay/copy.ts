// apps/app/app/bay/copy.ts — every visitor-facing string on the /bay surface,
// in one module so tests can hold the honesty bar (no probability framing, no
// slop, unknowns say unknown). Ported from ayaan-site's inline copy plus the
// check gate it enforced.

export const COPY = {
  title: 'the bay',
  intro: 'the bay',
  tagline: 'where to go, who to meet — mapped',
  hudLoading: 'loading the bay…',
  hudFailed: 'the bay did not load — try a reload',
  hudTilesFailed: 'the map tiles did not load — the dots still work',
  hudPlaces: 'places',
  hudEvents: 'events in the air',
  hudOfEvents: 'of',
  hudPlacesFailed: 'the places list did not load — the map is thinner than it should be',
  hudEventsFailed: 'the events list did not load — try again shortly',
  placeNoCoords: 'somewhere in the bay — no pin from the source',
  introTitle: 'the bay',
  introNotes: 'every place carries a first-person note. no bare pins.',
  introEvents: 'the red dots are events. score them with no signup.',
  introViews: 'a view re-ranks the map. it never hides anything.',
  introDismiss: 'got it',
  viewsTitle: 'views',
  viewNone: 'no view',
  layerCountsSuffix: '',
  askPlaceholder: 'ask the bay — where should I go tonight?',
  askSubmit: 'ask',
  askWorking: 'thinking…',
  answerHide: 'hide',
  answerNeedsProfile: 'paste a linkedin profile to get a personal read',
  scoreNeeded: 'paste your linkedin or a few lines about you',
  scoreProfileNeeded: 'i need a profile to score this — paste linkedin or a few lines',
  scoreBadSource: "that didn't parse as a profile or a linkedin url",
  scoreBadPersona: 'unknown view — pick one from the panel',
  scoreExpired: 'this event has ended',
  scoreMissing: 'this event is no longer on the map',
  scoreRateLimited: 'scoring is rate-limited right now — try again shortly',
  scoreFailed: 'the score did not come back — try again',
  claimTitle: 'keep this',
  claimBody: 'sign in and this profile, your asks, and your scores become yours.',
  claimCta: 'save my profile',
  claimSaving: 'saving…',
  claimDone: 'saved — this profile, your asks, and your scores are yours now',
  claimRetry: 'the capture pipeline could not store that profile — nothing was written; try again',
  signedInNote: 'signed in — scoring against your network',
  sessionEnded: 'your session ended — sign in again to keep this',
  reauthCta: 'sign in again',
  signOut: 'sign out',
  day: 'day',
  night: 'night',
  noReadOnRoom: 'no read on the room yet',
  // 'a fit weight is not a probability' — reasons describe, never percent.
  reasonPersonaFit: 'fits this view',
  reasonFreshness: 'coming up soon',
  reasonNetwork: 'your network overlaps',
  reasonPractical: 'free and nearby',
  reasonNone: 'no strong pull either way',
} as const;

/** The banned-words gate, applied at unit-test time over COPY and any reason
 * lines rendered on the surface. Ported from ayaan-site's UNSLOP scan. */
export const BANNED_WORDS = [
  'delve',
  'delving',
  'robust',
  'seamless',
  'seamlessly',
  'elevate',
  'unleash',
  'supercharge',
  'game-changer',
  'cutting-edge',
  'harness',
  'leverage',
  'tapestry',
  'testament',
] as const;

export function findBannedCopy(text: string): string[] {
  const hit: string[] = [];
  for (const word of BANNED_WORDS) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(text)) hit.push(word);
  }
  return hit;
}
