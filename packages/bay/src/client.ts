// packages/bay/src/client.ts
// the internal service boundary (spec locked decision 5): the shape of the old
// `_wingmic.js` client, kept so the score pipeline ports with minimal churn and the
// mock fixtures become test fixtures. the signed-in implementation reads the wingmic
// graph directly (router task); the boundary, the error semantics, and the degrade
// discipline are the part that survives here.
//
// degradation rule, unchanged from the old client: wingmic trouble degrades to
// [] — a score never fails because the network read did — except a dead key
// (WingmicAuthError), which cuts through: scoring with a silently empty network
// would be dishonest about who is in the room.

import type { BayRecord, Meet, VerifyResult, WingmicClient } from "./types.js";
import { WingmicAuthError } from "./types.js";
import { eventText, tokenize } from "./scoring.js";

// mock fixtures, carried from the old client: a demo profile + demo people. every
// surface that renders these must label them as a demo network — the honesty rule.
export const MOCK_PROFILE = {
  kind: "throwaway" as const,
  name: "sam rivera",
  headline: "product engineer exploring the bay, likes small rooms and real demos",
  roles: ["product engineer"],
  topics: ["agents", "hackathon", "builders"],
  goals: ["meet builders", "see what ships"],
  links: {},
  raw: "product engineer exploring the bay. likes small rooms and real demos.",
};

export const MOCK_PEOPLE = [
  {
    id: "mock-dex",
    name: "dex morales",
    topics: ["agents", "hackathon", "builders"],
    events: ["hackathon demo night"],
  },
  {
    id: "mock-priya",
    name: "priya nair",
    topics: ["inference", "infra", "developers"],
    events: ["inference infra meetup"],
  },
  {
    id: "mock-lena",
    name: "lena ohara",
    topics: ["founders", "startups", "cofounder"],
    events: ["founders coffee"],
  },
];

// the mock client. selfProfile: true — getProfile resolves the fixture profile, which
// is why mock runs can score against a "full" profile.
export class MockWingmicClient implements WingmicClient {
  readonly label = "mock";
  readonly selfProfile = true;

  async getProfile(): Promise<typeof MOCK_PROFILE> {
    return {
      ...MOCK_PROFILE,
      roles: [...MOCK_PROFILE.roles],
      topics: [...MOCK_PROFILE.topics],
      goals: [...MOCK_PROFILE.goals],
      links: {},
    };
  }

  // same overlap logic the old mock ran: who from the fixture list shows up in the
  // event's own words, strongest first, capped at 3.
  async networkOverlap(_token: string, ctx: { event: BayRecord; k?: number }): Promise<Meet[]> {
    const words = new Set(tokenize(eventText(ctx.event)));
    const hits = MOCK_PEOPLE.map((person) => {
      const shared = person.topics.filter((t) => words.has(t));
      return shared.length
        ? {
            who: person.name,
            why: `you share: ${shared.join(", ")}`,
            starter: "ask what they are working on",
          }
        : null;
    }).filter((m): m is Meet => Boolean(m));
    hits.sort((a, b) => b.why.length - a.why.length);
    const k = Math.max(1, Math.min(ctx.k ?? 3, 3));
    return hits.slice(0, k);
  }

  async verify(token: string): Promise<VerifyResult> {
    if (!token || typeof token !== "string") return { ok: false, reason: "unauthorized" };
    return { ok: true };
  }

  async capture(_token: string, payload: { text: string; id?: string }): Promise<boolean> {
    return Boolean(payload && payload.text);
  }
}

// wrap a network-overlap read: no client or no token -> []; client trouble -> [].
// WingmicAuthError rethrows — that is the one failure the caller must surface.
export async function overlapSafely(
  client: WingmicClient | null | undefined,
  token: string | null | undefined,
  ctx: { event: BayRecord; k?: number },
): Promise<Meet[]> {
  if (!client || !token) return [];
  try {
    return await client.networkOverlap(token, ctx);
  } catch (e) {
    if (e instanceof WingmicAuthError) throw e;
    return []; // degrade — never break a score because wingmic did
  }
}

export { WingmicAuthError };
