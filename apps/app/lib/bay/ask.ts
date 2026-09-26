import type {
  BayRecord,
  ChatFn,
  Meet,
  ProfileQuality,
  ScoreCard,
  Verdict,
  ViewerProfile,
} from '@wingmic/bay';
import {
  combineGoal,
  fallbackExplain,
  heuristicScore,
  parseJsonLoose,
  qualityOf,
  retrieve,
} from '@wingmic/bay';
import { parseIntent, type AskIntent } from './intent';

export interface AskPick {
  id: string;
  kind: 'event' | 'place';
  title: string;
  go: number;
  verdict: Verdict;
  outcome: string;
  reasons: string[];
  meet: Meet[];
}

export interface AskEmphasis {
  id: string;
  kind: 'event' | 'place';
  /** the typed 0..1 anchor the map paints with (data-driven radius/opacity) —
   * a fit weight is not a probability. */
  fit: number;
}

export interface AskResult {
  intent: AskIntent;
  answer: string;
  picks: AskPick[];
  emphasis: AskEmphasis[];
  /** which engine worded the answer — the honest signal on the card. */
  explain: 'llm' | 'template';
  /** which retrieval signal widened the pool. */
  retrieval: 'embeddings' | 'text';
  profile: { kind: string; quality: ProfileQuality };
}

export interface AskInput {
  q: string;
  personaId?: string | null;
  profile: ViewerProfile | null;
}

export interface AskDeps {
  places: BayRecord[];
  events: BayRecord[];
  /** per-event network overlap for signed-in viewers (the boundary degrades to
   * [] on its own); null when signed out. */
  meetsFor: ((event: BayRecord) => Promise<Meet[]>) | null;
  chat: ChatFn | null;
  model?: string | null;
  /** query-embedding similarity keyed by kinded record id ("event:<id>" /
   * "place:<id>") — the entity-recall F32 mechanism; null when unavailable. */
  embedding?: Map<string, number> | null;
  now?: number;
}

const TOP_PICKS = 3;
const MEET_POOL = 5;
const POOL_PER_SIGNAL = 8;

const ASK_SYSTEM =
  'you are the bay guide inside wingmic. answer one question about where to go or whom to ' +
  'meet, using only the picks given — never invent events, places or people. reply with only ' +
  'a json object: {"answer": "<2 to 3 short lowercase sentences, concrete, second person>"} ' +
  'lowercase voice, no em dashes, no probabilities, no corporate fluff.';

/** Deterministic template answer — the no-key path and the explainer-failure
 * fallback. Names the top pick with its own typed reason; says what it could
 * not read instead of bluffing. */
function templateAnswer(intent: AskIntent, picks: AskPick[], quality: ProfileQuality): string {
  if (!picks.length) {
    return intent === 'place'
      ? 'no places to read yet — the curated list is still filling in'
      : 'no live events to read yet — the board refills as sources land';
  }
  const top = picks[0];
  const reason = (top.reasons[0] ?? top.outcome).toLowerCase();
  if (top.go < 0.4) {
    return `honest read: nothing fits well right now. closest is ${top.title} — ${reason}`;
  }
  const backup = picks[1] ? ` ${picks[1].title} is the backup.` : '';
  const nudge =
    quality === 'thin' && !top.meet.length
      ? ' paste a few lines about yourself for a sharper read.'
      : '';
  return `${top.title} looks like your best ${intent === 'place' ? 'spot' : 'bet'} — ${reason}.${backup}${nudge}`;
}

/** The llm wording pass. The clamp is structural: the model sees only the typed
 * picks, answers with one string, and anything malformed falls back to the
 * template — it can never introduce records or move numbers. */
async function llmAnswer(
  chat: ChatFn,
  model: string | null | undefined,
  ctx: { q: string; intent: AskIntent; picks: AskPick[] },
): Promise<string> {
  const user = JSON.stringify({
    question: ctx.q,
    intent: ctx.intent,
    picks: ctx.picks.map((p) => ({
      title: p.title,
      kind: p.kind,
      verdict: p.verdict,
      outcome: p.outcome,
      reasons: p.reasons,
      meet: p.meet,
    })),
  });
  const text = await chat(
    [
      { role: 'system', content: ASK_SYSTEM },
      { role: 'user', content: user },
    ],
    { model },
  );
  const parsed = parseJsonLoose(text);
  const answer = typeof parsed.answer === 'string' ? parsed.answer.trim().slice(0, 600) : '';
  if (!answer) throw new Error('model returned no usable answer');
  return answer;
}

export async function runAsk(input: AskInput, deps: AskDeps): Promise<AskResult> {
  const now = deps.now ?? Date.now();
  const intent = parseIntent(input.q);
  const pool = (intent === 'place' ? deps.places : deps.events).slice();

  // retrieval — two signals over one pool. text cosine (pure feature hashing,
  // the old engine's ranker) always runs; f32 embedding similarity widens the
  // pool when the key is on. neither hides anything: they choose what gets
  // scored, while layer toggles still own visibility.
  const questionRanked = retrieve(input.q, pool);
  const prefix = intent === 'place' ? 'place:' : 'event:';
  const embById = new Map(
    [...(deps.embedding ?? new Map<string, number>()).entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, sim]) => [key.slice(prefix.length), sim] as const)
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, POOL_PER_SIGNAL),
  );
  const retrieval: AskResult['retrieval'] = embById.size > 0 ? 'embeddings' : 'text';

  const byId = new Map(questionRanked.slice(0, POOL_PER_SIGNAL).map((r) => [r.record.id, r.record]));
  for (const [id] of embById) {
    const rec = pool.find((r) => r.id === id);
    if (rec && !byId.has(id)) byId.set(id, rec);
  }
  const candidates = [...byId.values()];

  // the persona reaches the scorer only through the goal channel — never weights
  const goal = combineGoal(input.personaId, input.q);

  // network overlap for the top of the pool (signed-in viewers). the boundary
  // degrades to [] on its own; the catch here is for caller-supplied seams.
  const meetsById = new Map<string, Meet[]>();
  if (deps.meetsFor && intent !== 'place') {
    await Promise.all(
      questionRanked.slice(0, MEET_POOL).map(async ({ record }) => {
        if (!byId.has(record.id)) return;
        try {
          meetsById.set(record.id, await deps.meetsFor!(record));
        } catch {
          meetsById.set(record.id, []); // degrade — never break an ask because the graph did
        }
      }),
    );
  }

  // the typed anchor: one deterministic pass over every candidate. the llm,
  // when it runs, only words the answer — picks and numbers come from here.
  const scored = candidates
    .map((record) => {
      const meets = meetsById.get(record.id) ?? [];
      const h = heuristicScore({ profile: input.profile, event: record, goal, meets, now });
      return { record, h, meets };
    })
    .sort((a, b) => b.h.go - a.h.go || (a.record.id < b.record.id ? -1 : 1));

  const picks: AskPick[] = scored.slice(0, TOP_PICKS).map(({ record, h, meets }) => {
    const fb: ScoreCard = fallbackExplain(h, {
      profile: input.profile,
      event: record,
      goal,
      meets,
    });
    return {
      id: record.id,
      kind: record.type,
      title: record.title,
      go: fb.go,
      verdict: fb.verdict,
      outcome: fb.outcome,
      reasons: fb.reasons,
      meet: fb.meet,
    };
  });

  const emphasis: AskEmphasis[] = scored.map(({ record, h }) => ({
    id: record.id,
    kind: record.type,
    fit: h.go,
  }));

  const quality = qualityOf(input.profile);
  let answer = templateAnswer(intent, picks, quality);
  let explain: AskResult['explain'] = 'template';
  if (deps.chat && picks.length) {
    try {
      answer = await llmAnswer(deps.chat, deps.model, { q: input.q, intent, picks });
      explain = 'llm';
    } catch {
      // a score never fails because the explainer did — same rule for the ask
    }
  }

  return {
    intent,
    answer,
    picks,
    emphasis,
    explain,
    retrieval,
    profile: { kind: input.profile?.kind ?? 'none', quality },
  };
}
