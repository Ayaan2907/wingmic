# wingmic — planner handoff: working model + directive work packages

## Context

The user has fixed the project's working model: **Claude plans, Cursor executes, Codex + Grok review plans via their CLIs.** Claude writes no product code in this repo. Additionally, a standing engineering rule: **never build wrappers or patches — build primitive, reusable components imported per use-case.**

This plan converts the user's approved directives into executor-ready work packages (WPs). Every WP below except WP-2's ask-UI was **built and gate-validated this session** (typecheck + lint + tests green), then deliberately reverted so Cursor owns execution — so these specs are proven designs, not guesses.

**Repo state:** branch `claude/new-session-h2k6bs` at `a8a9781` (pushed). Already shipped and approved: tap-toggle orb (PR #55, merged to main via #57), CI test fix (`2636fd0`), nav arrangement 1A (`a8a9781` — search on the bar, acts via home, settings gear). Main's earlier red suite is fixed on this branch.

**Plan delivery:** on approval, this plan is committed as `docs/superpowers/plans/2026-08-04-directives-execution.md` (docs-only commit, pushed), issues filed per WP (issue-first convention), then handed to Cursor. Codex + Grok CLI review happens on this doc before Cursor starts, and on each PR diff before merge.

---

## WP-0 — Codify the working model in CLAUDE.md

Add to `CLAUDE.md`:
1. New section **"agent roles"**: Claude = planner (plans in `docs/superpowers/plans/`, no product code) · Cursor = executor (implements WPs, owns commits/PRs) · Codex + Grok = external plan/diff reviewers via CLI, run before execution starts and before each merge.
2. New convention under "conventions — non-negotiable": **"Primitives over wrappers. Never build wrapper components or patch-layers around existing code. Build small, primitive, reusable components/functions and import them per use-case. If a change wants a wrapper, extract the primitive instead."**

Commit: `docs(claude): agent roles + primitives-over-wrappers convention`.

---

## WP-1 — Extraction overhaul (directive 5: "everything")

**Problem (verified):** `packages/extractor/src/hybrid.ts` — Layer-1 (AssemblyAI NER) is stubbed empty (`transcribe-entities.ts`), Layer-2 is verbs+topics regex only, so the Layer-3 LLM is the *only* real extractor — yet its system prompt **forbids adding persons** (written as an enricher). Haiku breaks the rule inconsistently → sentence-initial verbs become entities ("Met with him" → person "Met").

**Changes (all validated green: 40 extractor tests + 128 app tests):**

1. **Rewrite `LINKER_SYSTEM`** in `hybrid.ts` as extractor-first. Validated prompt text to use verbatim:

```
You are the entity extractor for wingmic — short voice memos spoken right
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

Output the ExtractionResult JSON schema.
```

2. **Graph context:** `HybridInput` gains `knownContacts?: { persons: string[]; companies: string[] }`; `runLinkerLLM` gains the same optional third param and prepends a `Known contacts already in the speaker's graph: {json}` block to the user prompt. In `apps/app/lib/trpc/routers/capture.ts`, before `extractHybrid`: fetch 30 most-recently-updated entities (`ownerUserId = ctx.user.id`, `deletedAt IS NULL`, columns id+name) + companies reachable via those entities' `entityCompanies` links (cap 20) — **userId-scoped; company names come only via this user's links** (canonical company rows are shared; a user's association is not). Pass as `knownContacts`.

3. **Deterministic junk guard** — a *primitive* pure function `sanitizeExtraction(r: ExtractionResult)` exported from `hybrid.ts`, applied as the last step of `extractHybrid` (after `mergeResults`). Drops persons/companies/events whose cleaned name is <2 chars or whose tokens are ALL in `JUNK_NAMES ∪ STOPWORDS`. Validated `JUNK_NAMES` set:
   `met meet meeting talked spoke said told saw him her them he she they me we us it you i someone somebody anyone everybody guy girl dude man woman person people friend there here who that this today yesterday tomorrow`
   Multi-word names pass if any token is real ("Guy Fieri" ✓, "The Guy" ✗). Topics/actions untouched.

4. **Model default:** `apps/app/lib/config/env.ts` — `LINKER_MODEL` default `anthropic/claude-haiku-4.5` → `anthropic/claude-sonnet-4.6` (it's the primary extractor now; env still overrides). Comment why.

5. **Tests:** new `packages/extractor/src/__tests__/sanitize.test.ts` — cases: drops `Met`/`him`/`There`/`The Guy`, keeps `Sarah Chen`/`priya`; junk companies/events dropped, `Acme`/`DevConnect 26` kept; <2-char dropped; `Guy Fieri` passes; topics/actions untouched. Existing `hybrid.test.ts` mock re-implements `extractHybrid` inline, so it stays green without edits.

6. **Eval:** fixtures are untouchable. Run `bun run extract:eval:doppler` before/after (needs `OPENROUTER_API_KEY` — Claude's environment has none; Cursor/user runs it) and paste results in the PR.

Issue: file `[feat](extractor): LLM-first extraction + graph context + junk guard`. Commit: `feat(extractor): …` one PR.

---

## WP-2 — Chat dual-function, phase 1 (directive 2)

**Vision:** one thread, two verbs, modality-independent. Every inbound message (voice transcript or typed) goes through an intent router: **memo** → existing commit pipeline; **ask** ("find me that person", "who worked at acme?") → recall runs and the answer renders inline in the thread. Memo-biased: a memo misrouted as ask is data loss; an ask misrouted as memo is a deletable bubble. Every answer carries a "save as memo instead" escape hatch.

### 2a — Composer (validated green incl. 2 tests)
- `CaptureProvider` gains `submitText(text)`; `ChatClient` gains a sticky composer pill (input + `commit →`) above the nav (`bottom: TAB_BAR_HEIGHT_PX + 14`, maxWidth 640, pill styling per brand), hidden while the recorder is hot (`arming|recording|lock_armed|cancel_armed|locked`). Placeholder: `log a memo or ask — "who was the rust person?"` (mic-unavailable variant when `recorder.supported === false`). The Space shortcut already ignores INPUT/TEXTAREA — no change needed.

### 2b — Intent router (validated design)
In `CaptureProvider.tsx`, exported pure primitive:

```ts
const ASK_LEAD_RE =
  /^\s*(who|what|when|where|which|whose|how (?:do|did|many|long)|find|search|look up|list|show me|tell me|do i know|have i met|remind me (?:who|what|where|when))\b/i;
const FILLER_RE = /^\s*(?:so|hey|ok|okay|um|uh|hmm|well|yo|hi)[,\s]+/i;
export function classifyIntent(text: string): 'memo' | 'ask' {
  const t = text.trim().replace(FILLER_RE, '');
  if (/\?\s*$/.test(t)) return 'ask';
  if (ASK_LEAD_RE.test(t)) return 'ask';
  return 'memo';
}
```

Routing points:
- `submitText`: classify; ask → create bubble `status:'answering', intent:'ask'` + `runAskPipeline`; memo → current commit path with `intent:'memo'`.
- `runCapturePipeline`: after a non-empty transcript arrives (before the `linking` patch), classify; ask → `runAskPipeline(id, transcript)` and return — **a spoken question is answered, not archived**.
- `retryBubble`: first branch — `msg.intent === 'ask' && msg.transcript` → re-run ask (a failed ask must never silently commit as a memo).
- New `saveAskAsMemo(id)`: patch to `linking`/`intent:'memo'`, run `capture.commit` with the transcript.
- `runAskPipeline(id, q)`: `trpc.useUtils().recall.query.fetch({ q, limit: 5 })` → patch `answered` with mapped matches; on error patch `failed` with new code `ask_failed`. **Ordering gotcha (hit in validation): define it *after* the `patch` callback** or TS2448.

### 2c — Types (`apps/app/app/chat/_components/types.ts`)
- `BubbleStatus` += `'answering' | 'answered'`; `FailureCode` += `'ask_failed'`.
- New `AskMatch { id; name; role; company; topics; score }`, `AskResult { matches; durationMs; mode? }`.
- `ThreadMessage` += optional `intent?: 'memo'|'ask'`, `ask?: AskResult | null` (optional keeps all existing constructors valid).

### 2d — Thread rendering (`ChatThread.tsx`) — primitives, not one-offs
- `MessageBubble`: branch `answering|answered` → `AskExchange`.
- **Per the primitives rule, extract two reusable components** rather than inlining: `AgentBubble` (the left-side avatar + speech-bubble shell — currently duplicated across `WelcomeAgent` and `AgentReply`; refactor both to use it) and `EntityMatchCard` (name / role · company / topic pills, `Link` to `/person/{id}` — reusable later by search and the entity rail).
- `AskExchange` composes them: right-side question bubble ("asked · {time}") + `AgentBubble` containing: `answering` → pulsing "searching your graph…"; `answered` → "found N matches." (+ `· text match` when `mode==='text'`) + `EntityMatchCard` list + footer row: `open in search →` (`Link` to `/search?q=`) and `✎ save as memo instead` button → `saveAskAsMemo`.
- `failedKind`: `ask_failed` → `'search'`.

### 2e — Tests (`ChatClient.test.tsx`)
- Extend the tRPC mock with `useUtils: () => ({ recall: { query: { fetch: recallFetchMock } } })` — **required for every test in the file** since the provider calls it unconditionally; reset in `beforeEach`.
- Cases: typed question → `recallFetchMock` called with `{q, limit:5}`, answer + match name renders, `commit` NOT called · save-as-memo click → commit called with the transcript · voice question (transcribe fetch returns "who did I meet at acme?") → ask routed, commit not called · composer hides while recording · typed memo path unchanged.
- **Known pitfall from validation:** the typed-question rendering test failed once at handoff (suspects: async flush after `fetch` resolution needing an extra `waitFor`, or `next/link` UrlObject href in jsdom). Budget debugging time; the other paths were green.

### Phase 2 (plan later, do not build now)
Synthesized answers: Sonnet with `recall.query`/`entity.detail`/`graph.get` as AI-SDK tools, streamed into the thread; thread history persistence (`interactions.kind` column, new append-only migration) for coreference ("who else worked *there*?"). Plan when phase 1 merges.

Issue: `[feat](chat): dual-function thread — intent router + inline answers (phase 1)`. Suggested split: 2 PRs (composer+router+provider · ask UI+tests) or 1 if the diff stays reviewable.

---

## WP-3 — Search resilience (directive 3A) — validated green incl. new router test

**Root cause found:** `recall.query` hard-fails (raw 500 in UI) when the embedding call fails (missing/invalid `OPENROUTER_API_KEY`) or `vector_top_k` errors (prod DB missing migration `0002`).

1. `apps/app/lib/trpc/routers/recall.ts`: wrap embed + ANN + cosine-rescore in one `try`; on any failure set `mode='text'` and fall back to a LIKE match: tokenize query (`/[^a-z0-9]+/`, ≥2 chars, cap 6 terms), `SELECT id FROM entities WHERE ownerUserId = ctx.user.id AND (name LIKE %t% OR aliases LIKE %t% …) LIMIT input.limit` via Drizzle (`and/eq/or` + `sql` fragments for the LIKEs — `aliases` is a JSON text column, plain LIKE works). Scores stay 0 in text mode. Response gains `mode: 'semantic' | 'text'` on all return paths. Remove the now-dead `EmbeddingError`/`TRPCError` special-case imports.
2. `SearchClient.tsx`: append `· text match — semantic search offline` (accent color) to the match-count line when `mode === 'text'`.
3. Test (`recall.test.ts`): `embedText` mock `mockImplementationOnce(throw)` → `mode:'text'`, "alice" finds `e1` by name; next query recovers to `mode:'semantic'` with correct ranking.
4. **Ops task (likely the actual prod bug):** verify Railway has a valid `OPENROUTER_API_KEY` and that `bun run db:apply` ran against prod Turso (migration `0002_vector_top_k_entity_embedding`). Also applies to WP-6.

Issue: `[fix](recall): text fallback when semantic path unavailable`.

---

## WP-4 — Client-side tab navigation (directive 7) — validated green

Plain `<a href>` in the nav causes a full document load per tap. Standard SPA behavior = the framework router: swap to `next/link` (client-side transition + viewport prefetch).

- `BottomTabBar.tsx` `NavLink`: `<a>` → `<Link href={tab.href as Route}>` (`import type { Route } from 'next'` — typedRoutes needs the cast on the string union).
- `HomeClient.tsx`: logo `/`, settings gear `/settings`, acts `open →` `/acts` → `Link`.
- Optional same-PR: `ChatThread` suggestion chips → `Link` with `{ pathname: '/search', query: { q } }`.
- Tests unaffected (`AppShell.test` already mocks `next/link`; others assert render-only). Verify by eye in the running app: tab taps must not flash a document reload.

Issue: `[perf](app): client-side nav transitions`.

---

## WP-5 — Auth: 30-day sliding sessions (directive 6) — validated green

`apps/app/lib/auth.ts` session block gains `expiresIn: 60*60*24*30` and `updateAge: 60*60*24` (keep `cookieCache` as-is): sign in once, stay signed in while active. This is a session-handling change — dangerous-ops class — but explicitly user-directed; note that in the PR body. Future options already discussed (not in scope): Google OAuth one-tap (needs user's credentials), passkeys plugin, localStorage email prefill.

Issue: `[feat](auth): 30-day sliding sessions`.

---

## WP-6 — Graph "not there" verification (directive 4 — no code by default)

`/graph` shipped (#47, real `graph.get` + `react-force-graph-2d`) and reached main via #57 *minutes* before the report. Checklist: prod deploy is at/after #57 · migrations applied · `bun install` ran (new dep) · signed-in user with ≥1 entity sees nodes. Only file a bug if it still fails after that.

---

## Execution protocol (Cursor)

1. Order: WP-0 → WP-1 → WP-3 → WP-4 → WP-5 → WP-2 (largest last, lands on a healthy base) · WP-6 checklist anytime.
2. Per WP: file the issue → branch `feat/...` → implement → gate `bun run typecheck && bun run lint && bun run test` (turbo-first; bare vitest fails on unbuilt workspace deps; after dep changes re-run `bun install --frozen-lockfile` and clear `apps/app/.next`) → drive it live once (runbook in `docs/superpowers/plans/2026-08-04-v0.1.x-completion-handoff.md` §3: magic-link sign-in with zero secrets, Playwright `executablePath: /opt/pw-browsers/chromium-1194/chrome-linux/chrome`, orb needs `click({force:true})`) → PR to `staging` referencing the issue.
3. External review: Codex + Grok CLIs review this plan before execution starts, and each PR diff before merge.
4. Conventions: conventional commits, no AI trailers, brand voice, primitives over wrappers, never touch `design/**` / eval fixtures / existing migrations.

## Verification (end-to-end, after all WPs)

Local run: seed a few memos via the composer ("met sarah from acme, rust lead, send her the repo tomorrow") → graph card shows Sarah/Acme/action, **no junk entities from "met with him yesterday"** → ask "who was the rust person?" typed AND spoken → inline answer with Sarah's card → tab taps are instant (no reload) → search works with the API key removed (text-match label) → session survives a dev-server restart without re-login.
