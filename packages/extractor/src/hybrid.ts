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
  const llm = await runLinkerLLM(transcript, filled);
  return mergeResults(filled, llm);
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

const LINKER_SYSTEM = `You are a relation extractor for short post-meeting voice memos.
Given a transcript AND a list of already-detected entities, your job is to
fill in the RELATIONS that span-level NER cannot detect: per-person role and
company association, per-action target (which person an action refers to),
topics that link to specific people, and concise notes about each person.

Hard rules:
1. Do NOT add new persons, companies, events, or actions that weren't in the
   pre-detected list — only enrich what's there. The only exception is
   adding actions you find via verb phrases the pre-list missed.
2. Preserve original casing as the speaker said it. Lowercase stays lowercase.
3. If you can't determine a role or company for a person from the transcript,
   leave it null. Do NOT invent.
4. Action targets: only set targetPersonName if the transcript clearly names
   a person as the target ("send Sarah the link" → target=Sarah).
5. whenHint: ISO 8601 for absolute dates, speaker phrase verbatim otherwise.

Output the same JSON schema as ExtractionResult, with the pre-detected
entities preserved and the relations filled in.`;

/**
 * Call the linker LLM (Haiku via OpenRouter) with a scoped prompt.
 * Always called per locked decision #10 — not a gate, best-effort.
 *
 * Returns an empty result if OPENROUTER_API_KEY is missing, the
 * transcript is blank, or the LLM call fails for any reason (rate
 * limit, schema-validation, network 5xx, 8s timeout abort). Caller
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

  const userPrompt = `Pre-detected entities:\n${JSON.stringify(layer12Result, null, 2)}\n\nTranscript:\n"""\n${transcript}\n"""`;

  try {
    const { object } = await generateObject({
      model: linkerModel,
      schema: ExtractionResult,
      system: LINKER_SYSTEM,
      prompt: userPrompt,
      temperature: 0.1,
      abortSignal: AbortSignal.timeout(8000),
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
