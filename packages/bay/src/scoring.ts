// packages/bay/src/scoring.ts
// the bay event scoring pipeline: one stage per function, per the product spec.
//   1. retrieval , feature-hashing embeddings (fnv-1a, signed buckets, l2 normalized)
//      + cosine over the live event store. deterministic, zero deps, no key. it gives each
//      event a fit and gives the viewer a fit rank across the live set. an api-backed
//      embedder slots in behind embed()/retrieve() when the store outgrows local hashing.
//   2. typed score, heuristicScore: a fixed-weight blend over profile, goal, network and
//      timing facts. deterministic given fixed inputs, which is what the unit tests pin.
//      the same EventScorer shape later takes a jev scorer or the structured-output llm
//      (llmScore below, when the ai provider is on).
//   3. explain   , llmScore adds the outcome sentence, reasons and meet starters in one
//      structured json call, clamped near the typed score. with the ai off or the call
//      failing, fallbackExplain writes the same shape from templates, so the surface never
//      stalls on the llm.
// pure module: no env, no fetch, no log. the router wires the world in.
// ported byte-for-byte from ayaan-site api/_scoring.js (1bca780): identical arithmetic,
// identical constants, identical copy — the ported tests pin the outputs, not the types.

import type {
  BayRecord,
  ChatFn,
  HeuristicResult,
  Meet,
  ScoreCard,
  Verdict,
  ViewerProfile,
} from "./types.js";

export const EMBED_DIM = 96;

const STOP = new Set(
  ("a an and are as at be been but by for from has have i im in is it its me my of on or " +
    "our so that the their them they this to was we what who will with you your").split(" "),
);

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

const tokenize = (text: unknown): string[] =>
  String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));

// fnv-1a 32 bit. stable across processes, which is the point: the same text always
// lands in the same buckets.
const hash32 = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

// bag of tokens hashed into signed buckets, l2 normalized, so cosine(a, b) is a dot product.
export function embed(text: unknown): Float64Array {
  const counts = new Map<string, number>();
  for (const t of tokenize(text)) counts.set(t, (counts.get(t) || 0) + 1);
  const v = new Float64Array(EMBED_DIM);
  for (const [t, n] of counts) {
    const h = hash32(t);
    v[h % EMBED_DIM] += (h & 0x80000000 ? -1 : 1) * (1 + Math.log(n));
  }
  let norm = 0;
  for (let i = 0; i < EMBED_DIM; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < EMBED_DIM; i++) v[i] /= norm;
  return v;
}

const cosine = (a: Float64Array, b: Float64Array): number => {
  let d = 0;
  for (let i = 0; i < EMBED_DIM; i++) d += a[i] * b[i];
  return d;
};

const textOf = (parts: (string | undefined | null)[]): string =>
  parts.filter(Boolean).join(". ");
export const eventText = (e: Partial<BayRecord> | null | undefined): string =>
  textOf([e && e.title, e && e.note, e && e.venue, e && e.category, e && e.address]);
export const profileText = (p: Partial<ViewerProfile> | null): string =>
  p ? textOf([p.headline, p.raw, ...(p.roles || []), ...(p.topics || []), ...(p.goals || [])]) : "";

// stage 1: rank records by cosine to the profile text. ties break by id so the order is
// stable. a profile with no usable words gets fit 0 for everything (rank is meaningless
// then, and the caller says so instead of pretending).
export function retrieve(
  profileStr: string,
  records: BayRecord[],
  k: number = records.length,
): { record: BayRecord; fit: number }[] {
  const hasWords = tokenize(profileStr).length > 0;
  const q = hasWords ? embed(profileStr) : null;
  return records
    .map((record) => ({
      record,
      fit: q ? Math.max(0, round2(cosine(q, embed(eventText(record))))) : 0,
    }))
    .sort((a, b) => b.fit - a.fit || String(a.record.id).localeCompare(String(b.record.id)))
    .slice(0, k);
}

/* ---------- the viewer profile (the consume path) ---------- */

const oneLine = (v: unknown, max: number): string | undefined => {
  const s = String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return s ? s.slice(0, max) : undefined;
};
const cleanList = (v: unknown, maxItems = 12, maxLen = 80): string[] =>
  Array.isArray(v)
    ? [...new Set(v.map((x) => oneLine(x, maxLen)).filter(Boolean) as string[])].slice(0, maxItems)
    : [];

export interface ProfileInput {
  name?: unknown;
  headline?: unknown;
  roles?: unknown;
  topics?: unknown;
  goals?: unknown;
  links?: unknown;
  [key: string]: unknown;
}

// structured profile pasted or remembered client-side. allow-list only.
export function parseProfileInput(v: unknown): ViewerProfile | null {
  if (!v || typeof v !== "object") return null;
  const p = v as ProfileInput;
  const name = oneLine(p.name, 120);
  const headline = oneLine(p.headline, 200);
  const roles = cleanList(p.roles);
  const topics = cleanList(p.topics);
  const goals = cleanList(p.goals);
  const links: ViewerProfile["links"] = {};
  const rawLinks =
    p.links && typeof p.links === "object" ? (p.links as Record<string, unknown>) : {};
  for (const [k, u] of Object.entries(rawLinks)) {
    if (["linkedin", "github", "x", "site"].includes(k) && /^https:\/\//.test(String(u)))
      links[k as keyof ViewerProfile["links"]] = String(u).slice(0, 300);
  }
  if (
    !name &&
    !headline &&
    !roles.length &&
    !topics.length &&
    !goals.length &&
    !Object.keys(links).length
  )
    return null;
  return { kind: "pasted", name, headline, roles, topics, goals, links };
}

export type SourceInput =
  | { kind: "linkedin_url"; value: string }
  | { kind: "text"; value: string };

// the raw ask: a pasted profile or a linkedin url. parsing the paste into fields is the
// anonymous-linkedin task's job, so the text rides as raw and scoring reads it through
// retrieval only. a bare url is honest about being thin.
export function parseSourceInput(v: unknown): SourceInput | null {
  if (!v || typeof v !== "object") return null;
  const s = v as { kind?: unknown; value?: unknown };
  if (s.kind === "linkedin_url") {
    const url = String(s.value || "").trim();
    if (
      !/^https:\/\/(www\.)?linkedin\.com\/(in|pub|company)\/[^\s?#]+/i.test(url) ||
      url.length > 300
    )
      return null;
    return { kind: "linkedin_url", value: url };
  }
  if (s.kind === "text") {
    const text = String(s.value || "").trim();
    if (!text || text.length > 4000) return null;
    return { kind: "text", value: text };
  }
  return null;
}

// the paste parser: deterministic field-lifting from a pasted profile. this is the
// other half of the anonymous-linkedin path (the raw text rides into retrieval as-is):
// the lifted fields give the scorer and the ui something structured to read. no llm, no
// web lookups — only what the paste itself says, so nothing here can invent a fact.
const GOAL_RE = /^\s*(?:i\s+am\s+|im\s+)?(?:looking|looking for|seeking|hoping|open|want)\b(.*)$/i;
const TOPIC_RE = /^\s*(?:topics|interests|focus|stack)\s*[:\-]\s*(.+)$/i;
const AT_RE = /\s+at\s+/i;

export interface ParsedPaste {
  headline: string | undefined;
  roles: string[];
  topics: string[];
  goals: string[];
}

export function parsePaste(text: unknown): ParsedPaste | null {
  const lines = String(text || "")
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (!lines.length) return null;
  const headline = oneLine(lines[0], 200);
  const roles: string[] = [];
  const goals: string[] = [];
  const topics: string[] = [];
  // the headline usually names the role too ("ml engineer at acme")
  if (AT_RE.test(lines[0])) {
    const role = oneLine(lines[0].split(AT_RE)[0], 80);
    if (role) roles.push(role);
  }
  for (const line of lines.slice(1)) {
    if (TOPIC_RE.test(line)) {
      const m = TOPIC_RE.exec(line);
      if (m) for (const t of cleanList(m[1].split(/[,;/|]/), 12)) if (!topics.includes(t)) topics.push(t);
      continue;
    }
    if (GOAL_RE.test(line)) {
      const g = oneLine(line, 120);
      if (g && !goals.includes(g)) goals.push(g);
      continue;
    }
    // "ml engineer at acme" names a role; a bare line is not safely anything, so it
    // stays raw only and retrieval still reads it.
    if (AT_RE.test(line)) {
      const role = oneLine(line.split(AT_RE)[0], 80);
      if (role && !roles.includes(role)) roles.push(role);
    }
  }
  return { headline, roles, topics, goals };
}

export interface BuildProfileResult {
  profile: ViewerProfile | null;
  quality: ProfileQuality;
}

// build the viewer profile from what the request carries. wingmic tokens resolve
// through the client boundary (client.ts), never here.
export function buildProfile({
  profile,
  source,
}: {
  profile?: unknown;
  source?: unknown;
} = {}): BuildProfileResult {
  if (profile) {
    const p = parseProfileInput(profile);
    return p ? { profile: p, quality: qualityOf(p) } : { profile: null, quality: "none" };
  }
  if (source) {
    const s = parseSourceInput(source);
    if (!s) return { profile: null, quality: "none" };
    if (s.kind === "linkedin_url") {
      const p: ViewerProfile = {
        kind: "throwaway",
        name: undefined,
        headline: undefined,
        roles: [],
        topics: [],
        goals: [],
        links: { linkedin: s.value },
        raw: s.value,
      };
      return { profile: p, quality: qualityOf(p) };
    }
    const parsed = parsePaste(s.value) || ({ headline: undefined, roles: [], topics: [], goals: [] } as ParsedPaste);
    const p: ViewerProfile = {
      kind: "throwaway",
      name: undefined,
      headline: parsed.headline,
      roles: parsed.roles || [],
      topics: parsed.topics || [],
      goals: parsed.goals || [],
      links: {},
      raw: s.value,
    };
    return { profile: p, quality: qualityOf(p) };
  }
  return { profile: null, quality: "none" };
}

// thin = not enough on the profile to read the room sharply. the ui nudges for more.
// a null profile (a signed-in viewer with no self-read) is as thin as it gets.
export function qualityOf(p: Partial<ViewerProfile> | null): ProfileQuality {
  const q = p || {};
  const signals =
    (q.topics || []).length +
    (q.roles || []).length +
    (q.goals || []).length +
    (q.headline ? 1 : 0) +
    (q.raw && q.raw.length > 40 ? 2 : 0);
  return signals >= 3 ? "ok" : "thin";
}

/* ---------- stage 2: the typed scorer ---------- */

// weights are the whole calibration, so they live in one place and the tests pin them:
// prior 0.32, profile fit 0.40, goal fit 0.18, network overlap 0.10, starts-soon 0.04.
export function heuristicScore({
  profile,
  event,
  goal,
  meets = [],
  now = Date.now(),
  fit,
}: {
  profile?: Partial<ViewerProfile> | null;
  event?: Partial<BayRecord> | null;
  goal?: string | null;
  meets?: Meet[];
  now?: number;
  fit?: number | null;
} = {}): HeuristicResult {
  const p = profile || {};
  const eText = eventText(event);
  const pText = profileText(p);
  const pFit =
    fit != null ? fit : tokenize(pText).length ? Math.max(0, cosine(embed(pText), embed(eText))) : 0;
  const gFit =
    goal && tokenize(goal).length ? Math.max(0, round2(cosine(embed(goal), embed(eText)))) : 0;
  const net = Math.min(1, meets.length / 3);
  const startsIn = event && event.startsAt ? Date.parse(event.startsAt) - now : NaN;
  const soon = Number.isFinite(startsIn) && startsIn > 0 && startsIn < 72 * 3600e3 ? 1 : 0;

  const go = round2(clamp(0.32 + 0.4 * pFit + 0.18 * gFit + 0.1 * net + 0.04 * soon, 0.02, 0.97));
  const confidence = round2(
    clamp(
      0.3 +
        0.2 * Math.min(1, (p.topics || []).length / 4) +
        0.15 * (p.headline ? 1 : 0) +
        0.1 * ((p.roles || []).length ? 1 : 0) +
        0.15 * (goal && goal.trim() ? 1 : 0) +
        0.1 * net +
        (p.kind === "wingmic" ? 0.05 : 0),
      0.2,
      0.95,
    ),
  );
  return { go, confidence, facts: { pFit, gFit, net, soon } };
}

export const verdictOf = (go: number): Verdict => (go >= 0.6 ? "go" : go >= 0.4 ? "maybe" : "skip");

/* ---------- stage 3: the words ---------- */

// what kind of room an event draws, from its category. honest at the category level only:
// when attendee data is not knowable, say what kind of event it is instead of guessing who is in it.
export const SEGMENTS: Record<string, string> = {
  hackathons: "builders shipping against a clock",
  startups: "founders and early employees",
  tours: "newcomers out to see the city",
  sports: "the pickup-game regulars",
  housing: "people hunting rooms and roommates",
  offices: "the teams based there",
  events: "whoever the host pulls in",
};
export const segmentFor = (event: Partial<BayRecord> | null | undefined): string =>
  SEGMENTS[(event && event.category) || ""] || SEGMENTS.events;

// the profile words that appear on the event, for a reason you can check by eye.
export function sharedTokens(
  profile: Partial<ViewerProfile> | null | undefined,
  event: Partial<BayRecord> | null | undefined,
  goal?: string | null,
  max = 3,
): string[] {
  const eWords = new Set(tokenize(eventText(event)));
  const out: string[] = [];
  const from = [
    ...tokenize((profile && profile.headline) || ""),
    ...tokenize((profile && profile.raw) || ""),
    ...((profile && profile.topics) || []),
    ...((profile && profile.roles) || []),
  ];
  for (const t of from) for (const w of tokenize(t)) if (eWords.has(w) && !out.includes(w)) out.push(w);
  for (const w of tokenize(goal || "")) if (eWords.has(w) && !out.includes(w)) out.push(w);
  return out.slice(0, max);
}

export interface ExplainContext {
  profile?: Partial<ViewerProfile> | null;
  event?: Partial<BayRecord> | null;
  goal?: string | null;
  meets?: Meet[];
}

// deterministic explain, used when the ai provider is off or the llm call fails.
export function fallbackExplain(heuristic: HeuristicResult, ctx: ExplainContext = {}): ScoreCard {
  const { profile, event, goal, meets = [] } = ctx;
  const p = profile || {};
  const shared = sharedTokens(p, event, goal);
  const reasons: string[] = [];
  if (shared.length) reasons.push(`matches your world: ${shared.join(", ")}`);
  if (heuristic.facts.gFit > 0.2 && goal)
    reasons.push(`your goal ("${goal.trim().slice(0, 80)}") lines up with what this is`);
  if (meets.length) reasons.push(`${meets.length} of your people move in this circle`);
  if (heuristic.facts.soon) reasons.push("it starts within a couple of days, so plans stay easy");
  if (!reasons.length && p.kind === "wingmic") reasons.push("your wingmic network has no read on this room yet");
  if (!reasons.length) {
    reasons.push(
      qualityOf(p) === "ok"
        ? "little overlap with your profile so far"
        : "not enough profile yet for a sharp read; paste a few lines or add your linkedin",
    );
  }

  const seg = meets.length ? meets[0].who : segmentFor(event);
  let outcome: string;
  if (heuristic.go >= 0.6) outcome = `worth your time: expect to meet ${seg} and leave with something useful`;
  else if (heuristic.go >= 0.4)
    outcome = `coin toss: the room is ${seg}, and whether that helps depends on what you want that night`;
  else outcome = `likely a skip: the crowd (${seg}) does not connect to much on your profile`;

  const meet: Meet[] = meets.length
    ? meets.slice(0, 3)
    : [
        {
          who: seg,
          why: "this category of event draws them",
          starter: "ask what brought them out and what they are working on",
        },
      ];

  return {
    go: heuristic.go,
    verdict: verdictOf(heuristic.go),
    confidence: heuristic.confidence,
    outcome,
    reasons: reasons.slice(0, 4),
    meet,
    scorer: "typed",
  };
}

/* ---------- the llm path (structured output) ---------- */

export const SCORE_SYSTEM =
  "you score one bay area event for one visitor. reply with only a json object, no prose, no code fences: " +
  '{"go": <number 0..1, your call, within 0.15 of the suggested score>, ' +
  '"confidence": <number 0..1>, ' +
  '"outcome": <one plain sentence, lowercase, what this event likely turns out to be for this person>, ' +
  '"reasons": [<2 to 4 short lowercase strings, concrete, tied to the profile, goal or event>], ' +
  '"meet": [{"who": "...", "why": "...", "starter": "<one open question they could ask>"}]} ' +
  "for meet: real names from the network context when given, otherwise the kind of person this event draws. " +
  "lowercase voice, no em dashes, never invent facts about the event.";

export function parseJsonLoose(text: unknown): Record<string, unknown> {
  const s = String(text).replace(/```(?:json)?/g, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no json object in model reply");
  return JSON.parse(s.slice(start, end + 1)) as Record<string, unknown>;
}

const strArr = (v: unknown, max: number, maxLen: number): string[] =>
  Array.isArray(v)
    ? v
        .filter((x) => typeof x === "string" && x.trim())
        .map((x) => (x as string).trim().slice(0, maxLen))
        .slice(0, max)
    : [];

export interface LlmScoreArgs extends ExplainContext {
  chat: ChatFn;
  model?: string | null;
  heuristic: HeuristicResult;
  fitRank?: FitRank | null;
}

// one structured call that may refine the typed number (clamped to ±0.15 of it, so
// calibration stays anchored to the deterministic pass) and writes the words. throws on
// junk; the caller falls back to fallbackExplain.
export async function llmScore({
  chat,
  model,
  heuristic,
  profile,
  event,
  goal,
  meets = [],
  fitRank,
}: LlmScoreArgs): Promise<ScoreCard> {
  if (typeof chat !== "function") throw new Error("no chat function");
  const user = JSON.stringify({
    profile: {
      headline: profile && profile.headline,
      roles: profile && profile.roles,
      topics: profile && profile.topics,
      goals: profile && profile.goals,
      raw: profile && profile.raw,
    },
    goal: goal || "(none given)",
    event: {
      title: event && event.title,
      category: event && event.category,
      venue: event && event.venue,
      note: event && event.note,
      startsAt: event && event.startsAt,
      url: event && event.url,
    },
    network: meets.length ? meets : "none known; infer the audience from the event itself",
    rank: fitRank ? `#${fitRank.rank} of ${fitRank.of} live events by profile match` : undefined,
    suggestedScore: heuristic.go,
  });
  const text = await chat(
    [
      { role: "system", content: SCORE_SYSTEM },
      { role: "user", content: user },
    ],
    { model },
  );
  const j = parseJsonLoose(text);
  const go = Number(j.go);
  if (!Number.isFinite(go)) throw new Error("model returned a non-numeric go");
  const anchored = round2(clamp(clamp(go, 0, 1), heuristic.go - 0.15, heuristic.go + 0.15));
  const reasons = strArr(j.reasons, 4, 200);
  const meet = (Array.isArray(j.meet) ? j.meet : [])
    .map((m) => {
      if (!m || typeof m !== "object") return null;
      const r = m as Record<string, unknown>;
      return { who: oneLine(r.who, 120), why: oneLine(r.why, 200), starter: oneLine(r.starter, 200) };
    })
    .filter((m): m is Meet => Boolean(m && m.who))
    .slice(0, 3);
  if (!reasons.length) throw new Error("model returned no usable reasons");

  const fb = fallbackExplain(heuristic, { profile, event, goal, meets });
  return {
    go: anchored,
    verdict: verdictOf(anchored),
    confidence: round2(clamp(Number(j.confidence) || heuristic.confidence, 0.3, 0.97)),
    outcome: oneLine(j.outcome, 300) || fb.outcome,
    reasons,
    meet: meet.length ? meet : fb.meet,
    scorer: "llm",
  };
}
