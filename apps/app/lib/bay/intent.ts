/**
 * The ask's intent parser: one question in, one of four readings out.
 * Deterministic keyword heuristics only — no llm on this path — so the same
 * question always parses the same way and the ask never fails because an intent
 * call did.
 */
export type AskIntent = 'place' | 'event' | 'person' | 'plan';

// order is load-bearing: "who should I meet at the hackathon" is a person ask
// even though it names an event; "where should I go tonight" is an event ask
// even though it starts with "where".
const PERSON_RE =
  /\b(who|people|persons?|someone|somebody|meet|meeting|founders?|investors?|engineers?|intros?|connect)\b/i;
const EVENT_RE =
  /\b(tonight|this week|weekend|events?|meetups?|hackathons?|demo day|conferences?|talks?|parties?|launch|happening|going on|go to)\b/i;
const PLACE_RE =
  /\b(where|cafe|cafes|coffee|work from|workspace|coworking|offices?|apartments?|housing|roommates?|neighborhoods?|neighbourhoods?|places?|spots?|gyms?|parks?|library|food|lunch|dinner|bars?|live)\b/i;

export function parseIntent(q: string): AskIntent {
  const s = String(q ?? '');
  if (PERSON_RE.test(s)) return 'person';
  if (EVENT_RE.test(s)) return 'event';
  if (PLACE_RE.test(s)) return 'place';
  return 'plan';
}
