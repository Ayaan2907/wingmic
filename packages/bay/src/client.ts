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

// mock fixtures, carried verbatim from the old client: a demo profile + demo people
// with topic words. overlap is a plain token match against the event, so the same
// event always produces the same list. every surface that renders these must label
// them as a demo network — the honesty rule.
export const MOCK_PROFILE = {
  kind: "wingmic" as const,
  name: "sam rivera",
  headline: "ml engineer at a 12 person infra startup, weighing a founder move",
  roles: ["ml engineer", "founding engineer"],
  topics: ["ai agents", "developer tools", "inference infra", "edge configs"],
  goals: ["find a cofounder", "meet builders shipping fast"],
  links: { linkedin: "https://www.linkedin.com/in/sam-rivera-mock" },
};

export const MOCK_PEOPLE = [
  {
    who: "dex morales",
    topics: ["agents", "hackathon", "builders"],
    why: "built the agent eval harness you kept citing",
    starter: "ask what they have shipped since the last demo night",
  },
  {
    who: "priya nair",
    topics: ["inference", "infra", "developers"],
    why: "runs the platform work your last two projects leaned on",
    starter: "ask how they sized inference for the last launch",
  },
  {
    who: "lena kwan",
    topics: ["founders", "startups", "cofounder"],
    why: "made the founder move you are weighing",
    starter: "ask what they would do differently in the first 90 days",
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
      links: { ...MOCK_PROFILE.links },
    };
  }

  // same overlap logic the old mock ran: people whose topic words hit the event's own
  // words, strongest match first, capped at 3. people who miss stay out of it: the
  // demo must not pretend the network is bigger than it is.
  async networkOverlap(_token: string, ctx: { event: BayRecord; k?: number }): Promise<Meet[]> {
    const words = new Set(tokenize(eventText(ctx.event)));
    return MOCK_PEOPLE.map((p) => {
      const hits = p.topics.flatMap((t) => tokenize(t)).filter((w) => words.has(w)).length;
      return { p, hits };
    })
      .filter((x) => x.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, Math.max(1, Math.min(ctx.k ?? 3, 3)))
      .map((x) => ({ who: x.p.who, why: x.p.why, starter: x.p.starter }));
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
