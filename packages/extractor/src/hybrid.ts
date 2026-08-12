/**
 * Hybrid extractor — Task H4 of v0.1.1 Hosted Capture.
 *
 * Three layers turn a transcript + AssemblyAI span-level entities into the
 * existing `ExtractionResult` Zod shape that resolution.ts already consumes.
 *
 *   Layer 1  mapProviderEntities  → skeleton from AssemblyAI spans
 *   Layer 2  applyHeuristics      → action verbs + topic frequencies
 *   Layer 3  runLinkerLLM         → Haiku relation extractor (default,
 *                                   not a gate — locked decision #10)
 *
 * Merge precedence is spelled out in plan TODO §C1 and re-encoded below.
 *
 * Non-goals for Layer-2 (regex too brittle):
 *   - person ↔ company linking
 *   - role detection
 * Those are Layer-3's job.
 */
import { generateObject } from 'ai';
import {
  ExtractionResult,
  type PersonCandidate,
  type CompanyCandidate,
  type EventCandidate,
  type ActionCandidate,
} from './schema';
import type { AssemblyAIEntity } from './types';
import { linkerModel } from './models';
import { STOPWORDS } from './stopwords';
import { env } from '../../../apps/app/lib/config/env';

export interface HybridInput {
  transcript: string;
  providerEntities?: AssemblyAIEntity[];
  knownContacts?: { persons: string[]; companies: string[] };
}

// ──────────────────────────────────────────────────────────────────────
// Public entrypoint
// ──────────────────────────────────────────────────────────────────────

/**
 * Run the hybrid extractor pipeline.
 *
 * Per locked decision #10, Layer-3 (Haiku via OpenRouter) is the DEFAULT
 * relation extractor — it runs on every memo, not as a confidence gate. It
 * fills relations Layer-1+2 cannot detect: per-person role, companyHint,
 * action targets (which person an action refers to), and per-person notes.
 *
 * Pipeline:
 *   Layer-1  mapProviderEntities  — span-level NER from AssemblyAI entities
 *                                   (currently stubbed to empty per
 *                                   `transcribe-entities.ts`; the AAI entity
 *                                   detection toggle isn't wired yet).
 *   Layer-2  applyHeuristics      — deterministic regex over the transcript:
 *                                   action-verb phrases and top-3 frequent
 *                                   non-stopword tokens for topics.
 *   Layer-3  runLinkerLLM         — best-effort LLM call with an 8-second
 *                                   timeout. On any failure (rate limit,
 *                                   schema-validation, network 5xx, timeout)
 *                                   it returns an empty result so mergeResults
 *                                   becomes a no-op and the caller still gets
 *                                   the Layer-1+2 result back.
 *
 * Contract: extractHybrid never throws on LLM failure — callers always get
 * a valid ExtractionResult.
 */
export async function extractHybrid({
  transcript,
  providerEntities,
  knownContacts,
}: HybridInput): Promise<ExtractionResult> {
  const entities = providerEntities ?? [];
  const skeleton = mapProviderEntities(entities);
  // Date spans are NOT synthesized into actions by Layer-1 (pure entity
  // layer shouldn't invent actions). They are passed to Layer-2 so the
  // heuristic verb-matcher can attach them as whenHint when a date string
  // appears inside a verb's 80-char body window. The LLM also sees the
  // raw transcript and handles whenHint extraction independently as a
  // fallback when Layer-2 misses.
  const dateSpans = entities
    .filter((e) => e.entity_type.toLowerCase() === 'date')
    .map((e) => e.text);
  const filled = applyHeuristics(skeleton, transcript, dateSpans);
  const llm = await runLinkerLLM(transcript, filled, knownContacts);
  const merged = mergeResults(filled, llm);
  return sanitizeExtraction(merged);
}

// ──────────────────────────────────────────────────────────────────────
// Layer 1 — span-level entity → ExtractionResult skeleton
// ──────────────────────────────────────────────────────────────────────

const IMPERATIVE_VERBS = [
  'send',
  'remind',
  'email',
  'follow up',
  'follow-up',
  'ping',
  'intro',
  'meet',
  'call',
  'check in',
];

/**
 * Pure mapping from AssemblyAI span outputs to the Zod ExtractionResult
 * shape. Only fills entity-level data; relations (role, companyHint,
 * action targets, person↔topic) are Layer-3's job.
 */
export function mapProviderEntities(entities: AssemblyAIEntity[]): ExtractionResult {
  const persons: PersonCandidate[] = [];
  const companies: CompanyCandidate[] = [];
  const events: EventCandidate[] = [];
  const actions: ActionCandidate[] = [];

  const seenPersons = new Set<string>();
  const seenCompanies = new Set<string>();
  const seenEvents = new Set<string>();

  // Track event spans for nearby-location attachment
  const eventSpans: Array<{ entity: EventCandidate; start: number; end: number }> = [];

  for (const e of entities) {
    const type = e.entity_type.toLowerCase();
    const lowerName = e.text.toLowerCase();

    if (type === 'person_name') {
      if (seenPersons.has(lowerName)) continue;
      seenPersons.add(lowerName);
      persons.push({
        name: e.text,
        aliases: [],
        role: null,
        companyHint: null,
        topics: [],
        email: null,
        linkedin: null,
        notes: null,
      });
    } else if (type === 'organization') {
      if (seenCompanies.has(lowerName)) continue;
      seenCompanies.add(lowerName);
      companies.push({
        name: e.text,
        domainHint: null,
        industry: [],
      });
    } else if (type === 'event' || type === 'event_name') {
      if (seenEvents.has(lowerName)) continue;
      seenEvents.add(lowerName);
      const ev: EventCandidate = {
        name: e.text,
        dateHint: null,
        location: null,
      };
      events.push(ev);
      eventSpans.push({ entity: ev, start: e.start, end: e.end });
    }
  }

  // Second pass: attach locations and dates by proximity
  for (const e of entities) {
    const type = e.entity_type.toLowerCase();

    if (type === 'location') {
      // Find the nearest event within 10 word-positions
      const nearest = findNearestEventByWordDistance(e, eventSpans, 10);
      if (nearest) {
        if (!nearest.entity.location) nearest.entity.location = e.text;
      } else if (eventSpans.length > 0) {
        // fall back to first event
        if (!eventSpans[0].entity.location) eventSpans[0].entity.location = e.text;
      }
      // else: drop the location entirely
    }
  }

  // NOTE: date spans are intentionally NOT synthesized into actions here.
  // Per the H4 code review, the pure entity layer must not invent actions.
  // Date spans are extracted by `extractHybrid` and threaded to
  // `applyHeuristics` so the heuristic verb-matcher can attach a whenHint
  // only when a date appears inside the body of a real action verb. The
  // LLM layer also receives the raw transcript and handles whenHint
  // extraction as an independent fallback.

  return { persons, companies, events, topics: [], actions };
}

function findNearestEventByWordDistance(
  loc: AssemblyAIEntity,
  events: Array<{ entity: EventCandidate; start: number; end: number }>,
  maxWords: number,
): { entity: EventCandidate; start: number; end: number } | null {
  // Approximate "word position" as character offset / 6 (rough average
  // english word length including space).
  const APPROX_CHARS_PER_WORD = 6;
  const locWord = loc.start / APPROX_CHARS_PER_WORD;
  let best: { entity: EventCandidate; start: number; end: number } | null = null;
  let bestDist = Infinity;
  for (const ev of events) {
    const evWord = ev.start / APPROX_CHARS_PER_WORD;
    const dist = Math.abs(evWord - locWord);
    if (dist < bestDist && dist <= maxWords) {
      bestDist = dist;
      best = ev;
    }
  }
  return best;
}

// ──────────────────────────────────────────────────────────────────────
// Layer 2 — regex / heuristic extraction
// ──────────────────────────────────────────────────────────────────────

const ACTION_VERB_RE = /\b(send|email|remind|todo|intro|message|follow[- ]up|ping|check in|call|meet)\b/gi;

function mapVerbToKind(verb: string): ActionCandidate['kind'] {
  const v = verb.toLowerCase().trim();
  if (v === 'send' || v === 'email') return 'email';
  if (v === 'remind' || v === 'todo') return 'reminder';
  if (v === 'intro') return 'intro';
  if (v === 'follow-up' || v === 'follow up') return 'todo';
  // meet, call, message, ping, check in
  return 'meeting';
}

/**
 * Pure heuristic enrichment over the Layer-1 skeleton. Adds:
 *   - Action verb phrases (regex) → ActionCandidate
 *   - Top-3 frequent ≥4-char words → top-level topics
 *
 * Does NOT touch relations (role, companyHint, person.topics). Those are
 * Layer-3's job per locked decision #10.
 *
 * `dateSpans` is the Layer-1 side output of AssemblyAI date entities. When
 * a date span's text appears inside an action body, it is attached as
 * `whenHint`. This replaces the Layer-1 "(date noted) X" synthesized
 * action that the H4 code review flagged as inventing actions in the
 * pure entity layer.
 */
export function applyHeuristics(
  skeleton: ExtractionResult,
  transcript: string,
  dateSpans: string[] = [],
): ExtractionResult {
  const actions = [...skeleton.actions];
  const existing = new Set(actions.map((a) => a.body.trim().toLowerCase()));

  // ── Action verbs ────────────────────────────────────────────────────
  const matches = [...transcript.matchAll(ACTION_VERB_RE)];
  for (const m of matches) {
    const verb = m[1];
    const start = m.index ?? 0;
    // Capture up to 80 chars forward from the verb as the action body
    const slice = transcript.slice(start, start + 80);
    // Trim at the next sentence boundary if any
    const cut = slice.search(/[.!?\n]/);
    const body = (cut > 0 ? slice.slice(0, cut) : slice).trim();
    if (!body) continue;
    const key = body.toLowerCase();
    if (existing.has(key)) continue;
    existing.add(key);
    // Attach whenHint if any date span's text appears in this body.
    const bodyLower = body.toLowerCase();
    const matchedDate = dateSpans.find((d) => bodyLower.includes(d.toLowerCase()));
    actions.push({
      kind: mapVerbToKind(verb),
      body,
      whenHint: matchedDate ?? null,
      targetPersonName: null,
    });
  }

  // ── Topics: top-3 unique ≥4-char words excluding stopwords ─────────
  const tokens = transcript
    .toLowerCase()
    .split(/[\s.,;:!?"'()\[\]{}<>/\\]+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t) && /^[a-z][a-z+#-]*$/.test(t));
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  const ranked = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([word]) => word);

  const topics = [...skeleton.topics];
  const topicSet = new Set(topics);
  for (const t of ranked) {
    if (!topicSet.has(t)) {
      topics.push(t);
      topicSet.add(t);
    }
  }

  return {
    persons: skeleton.persons,
    companies: skeleton.companies,
    events: skeleton.events,
    topics,
    actions,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Layer 3 — LLM relation linker (Haiku, default per locked decision #10)
// ──────────────────────────────────────────────────────────────────────

const LINKER_SYSTEM = `You are the entity extractor for wingmic — short voice memos spoken right
after meeting someone. Turn the transcript into the structured graph
payload: persons, companies, events, topics, and follow-up actions.

Hard rules:
1. A person requires an ACTUAL NAME. Pronouns ("him", "her", "they"), bare
   role references ("the CTO", "that guy"), and verbs or filler words
   mistaken for names ("Met", "Talked") are NEVER persons. If someone is
   unnamed, fold what you learned into the nearest named person's notes —
   or omit it. An empty persons list is better than a garbage one.
2. Transcripts are speech-to-text: sentence-initial capitalization is NOT
   evidence of a proper noun. "Met with him yesterday" contains zero persons.
3. Never invent. Unknown role/company/date → null. No fabricated emails,
   companies, or facts.
4. Preserve the speaker's casing for names. Lowercase stays lowercase.
5. Actions are things the speaker committed to (kind: email, reminder,
   intro, todo, meeting). Set targetPersonName only when the transcript
   names the target explicitly ("send Sarah the link" → target=Sarah).
6. whenHint: ISO 8601 for absolute dates, speaker phrase verbatim otherwise.
7. Pre-detected entities (when provided) are hints to enrich — not a cage.
   Add real entities they missed; ignore any hint that violates rule 1.
8. Known contacts (when provided) are people/companies already in the
   speaker's graph. If the transcript plausibly refers to one of them, reuse
   that exact stored name and put the spoken variant in aliases — do not
   mint a near-duplicate.
9. topics are noun subjects worth remembering (e.g. "rust", "co-working",
   "relocation"). NEVER verbs ("discussed", "met"), NEVER person or company
   names already listed under persons/companies, NEVER single fragments of a
   place name when the full place is already a topic. Prefer fewer topics.

Output the ExtractionResult JSON schema.`;

/**
 * Call the linker LLM (Haiku via OpenRouter) with a scoped prompt.
 * Always called per locked decision #10 — not a gate, best-effort.
 *
 * Returns an empty result if OPENROUTER_API_KEY is missing, the
 * transcript is blank, or the LLM call fails for any reason (rate
 * limit, schema-validation, network 5xx, 20s timeout abort). Caller
 * (`extractHybrid`) treats this as a no-op merge and returns the
 * Layer-1+2 result alone.
 *
 * Logging note: `console.warn` is used here until `packages/logger`
 * lands via issue #12 — at which point this should switch to the
 * shared logger.
 */
export async function runLinkerLLM(
  transcript: string,
  layer12Result: ExtractionResult,
  knownContacts?: { persons: string[]; companies: string[] },
): Promise<ExtractionResult> {
  const empty: ExtractionResult = {
    persons: [],
    companies: [],
    events: [],
    topics: [],
    actions: [],
  };
  if (!env.OPENROUTER_API_KEY) return empty;
  if (!transcript.trim()) return empty;

  let userPrompt = '';
  if (knownContacts && (knownContacts.persons.length > 0 || knownContacts.companies.length > 0)) {
    userPrompt += `Known contacts already in the speaker's graph: ${JSON.stringify(knownContacts)}\n\n`;
  }
  userPrompt += `Pre-detected entities:\n${JSON.stringify(layer12Result, null, 2)}\n\nTranscript:\n"""\n${transcript}\n"""`;

  try {
    const { object } = await generateObject({
      model: linkerModel,
      schema: ExtractionResult,
      system: LINKER_SYSTEM,
      prompt: userPrompt,
      temperature: 0.1,
      abortSignal: AbortSignal.timeout(20000),
    });
    return object;
  } catch (err) {
    // Best-effort: rate-limit, schema-validation, network 5xx, or the
    // 8s timeout abort all land here. Fall back to Layer-1+2 alone.
    console.warn('[extractor] runLinkerLLM failed, falling back to Layer-1+2:', err);
    return empty;
  }
}

// ──────────────────────────────────────────────────────────────────────
// sanitizeExtraction — deterministic junk-name guard (#58)
// ──────────────────────────────────────────────────────────────────────

const JUNK_NAMES = new Set([
  'met',
  'meet',
  'meeting',
  'talked',
  'spoke',
  'said',
  'told',
  'saw',
  'him',
  'her',
  'them',
  'he',
  'she',
  'they',
  'me',
  'we',
  'us',
  'it',
  'you',
  'i',
  'someone',
  'somebody',
  'anyone',
  'everybody',
  'guy',
  'girl',
  'dude',
  'man',
  'woman',
  'person',
  'people',
  'friend',
  'there',
  'here',
  'who',
  'that',
  'this',
  'today',
  'yesterday',
  'tomorrow',
]);

function cleanNameTokens(name: string): string[] {
  return name
    .trim()
    .toLowerCase()
    .split(/[\s.,;:!?"'()\[\]{}<>/\\-]+/)
    .filter(Boolean);
}

function isJunkName(name: string): boolean {
  const tokens = cleanNameTokens(name);
  if (tokens.length === 0 || name.trim().length < 2) return true;
  return tokens.every((t) => JUNK_NAMES.has(t) || STOPWORDS.has(t));
}

/** Drop pronoun/verb/stopword junk from entity names + topics — last step of extractHybrid. */
export function sanitizeExtraction(r: ExtractionResult): ExtractionResult {
  const persons = r.persons.filter((p) => !isJunkName(p.name));
  const companies = r.companies.filter((c) => !isJunkName(c.name));
  const events = r.events.filter((e) => !isJunkName(e.name));
  return {
    persons,
    companies,
    events,
    topics: sanitizeTopics(r.topics, { persons, companies, events }),
    actions: r.actions,
  };
}

/**
 * Topics must be recallable subjects — not speech verbs, not echoes of
 * entities already captured as people/companies/events.
 */
export function sanitizeTopics(
  topics: string[],
  entities: {
    persons: Array<{ name: string }>;
    companies: Array<{ name: string }>;
    events: Array<{ name: string }>;
  },
): string[] {
  const entityNames = new Set<string>();
  const entityTokens = new Set<string>();
  for (const e of [...entities.persons, ...entities.companies, ...entities.events]) {
    const full = e.name.trim().toLowerCase();
    if (!full) continue;
    entityNames.add(full);
    for (const tok of cleanNameTokens(e.name)) {
      if (tok.length >= 3) entityTokens.add(tok);
    }
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of topics) {
    const t = raw.trim();
    if (!t) continue;
    const lower = t.toLowerCase();
    if (seen.has(lower)) continue;
    if (lower.length < 3) continue;
    if (STOPWORDS.has(lower) || JUNK_NAMES.has(lower)) continue;
    if (entityNames.has(lower)) continue;
    // Single-token topics that are just a piece of an extracted name ("lucas"
    // when person "Lucas" is already captured) drop out.
    const tokens = cleanNameTokens(t);
    if (tokens.length === 1 && entityTokens.has(tokens[0]!)) continue;
    if (tokens.every((tok) => STOPWORDS.has(tok) || JUNK_NAMES.has(tok))) continue;
    seen.add(lower);
    out.push(t);
  }

  // Drop single-token topics that are fragments of another kept multi-word topic
  // (e.g. "francisco" when "San Francisco" is also a topic).
  const multiTokenBags = out
    .map((t) => cleanNameTokens(t))
    .filter((toks) => toks.length >= 2);
  return out.filter((t) => {
    const toks = cleanNameTokens(t);
    if (toks.length !== 1) return true;
    const alone = toks[0]!;
    return !multiTokenBags.some((bag) => bag.includes(alone));
  });
}

// ──────────────────────────────────────────────────────────────────────
// mergeResults — explicit precedence per plan TODO §C1
// ──────────────────────────────────────────────────────────────────────

/**
 * Explicit precedence rules:
 *   person.name              prefer filled (Layer-1+2 is source of truth)
 *   person.role              LLM fills (filled.role is always null)
 *   person.companyHint       LLM fills (relation, not entity)
 *   person.topics            union, deduped
 *   person.notes             LLM fills
 *   person.email             prefer LLM (Layer-2 may set this in v0.1.1b)
 *   person.linkedin          prefer LLM
 *   person.aliases           union, deduped
 *   companies (by name)      union; prefer filled.domainHint, union industry
 *   events (by name)         union; prefer filled.dateHint/location
 *   topics                   union, deduped
 *   actions (by body)        union; prefer LLM targetPersonName + whenHint
 */
export function mergeResults(
  filled: ExtractionResult,
  llm: ExtractionResult,
): ExtractionResult {
  // ── Persons: index by lowercased name ───────────────────────────────
  const personByName = new Map<string, PersonCandidate>();
  for (const p of filled.persons) personByName.set(p.name.toLowerCase(), { ...p });

  for (const lp of llm.persons) {
    const key = lp.name.toLowerCase();
    const existing = personByName.get(key);
    if (!existing) {
      // LLM-only person (no Layer-1+2 match). Keep it — this is the
      // fallback path when providerEntities is empty. The LLM's system
      // prompt forbids inventing persons; if it does anyway, downstream
      // resolution.ts will treat it like any other PersonCandidate.
      personByName.set(key, { ...lp });
      continue;
    }
    existing.role = existing.role ?? lp.role;
    existing.companyHint = existing.companyHint ?? lp.companyHint;
    existing.notes = existing.notes ?? lp.notes;
    existing.email = lp.email ?? existing.email;
    existing.linkedin = lp.linkedin ?? existing.linkedin;
    existing.topics = unionDedup(existing.topics, lp.topics);
    existing.aliases = unionDedup(existing.aliases, lp.aliases);
  }
  const persons = [...personByName.values()];

  // ── Companies: union by name.toLowerCase() ──────────────────────────
  const companyByName = new Map<string, CompanyCandidate>();
  for (const c of filled.companies) companyByName.set(c.name.toLowerCase(), { ...c });
  for (const c of llm.companies) {
    const key = c.name.toLowerCase();
    const existing = companyByName.get(key);
    if (!existing) {
      companyByName.set(key, { ...c });
    } else {
      existing.domainHint = existing.domainHint ?? c.domainHint;
      existing.industry = unionDedup(existing.industry, c.industry);
    }
  }
  const companies = [...companyByName.values()];

  // ── Events: union by name.toLowerCase() ─────────────────────────────
  const eventByName = new Map<string, EventCandidate>();
  for (const e of filled.events) eventByName.set(e.name.toLowerCase(), { ...e });
  for (const e of llm.events) {
    const key = e.name.toLowerCase();
    const existing = eventByName.get(key);
    if (!existing) {
      eventByName.set(key, { ...e });
    } else {
      existing.dateHint = existing.dateHint ?? e.dateHint;
      existing.location = existing.location ?? e.location;
    }
  }
  const events = [...eventByName.values()];

  // ── Topics ──────────────────────────────────────────────────────────
  const topics = unionDedup(filled.topics, llm.topics);

  // ── Actions: union by body.trim().toLowerCase() ─────────────────────
  const actionByBody = new Map<string, ActionCandidate>();
  for (const a of filled.actions) actionByBody.set(a.body.trim().toLowerCase(), { ...a });
  for (const a of llm.actions) {
    const key = a.body.trim().toLowerCase();
    const existing = actionByBody.get(key);
    if (!existing) {
      actionByBody.set(key, { ...a });
    } else {
      // LLM wins on relation fields
      existing.targetPersonName = a.targetPersonName ?? existing.targetPersonName;
      existing.whenHint = a.whenHint ?? existing.whenHint;
    }
  }
  const actions = [...actionByBody.values()];

  return { persons, companies, events, topics, actions };
}

function unionDedup<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  const seen = new Set<T>();
  for (const x of [...a, ...b]) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}
