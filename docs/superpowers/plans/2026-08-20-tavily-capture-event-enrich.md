# Tavily capture + event enrich Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the already-merged Tavily `WebSearchProvider` into two async, env-gated enrich paths: person blanks after a local miss (`#125`) and canonical event date/location/url (`#127`), after the event `external_*` columns (`#126`).

**Architecture:** PR #133 landed the library only. `webSearchProviderFromEnv()` is exported from `apps/app/lib/web-search/` and is not imported by capture, graph, or recall. Enrich lives under `apps/app/lib/enrich/` (no new top-level package). Call sites use `WebSearchProvider.search` / `.extract` plus `buildWebSearchQuery` / `isBlockedExtractUrl`. Never import `tavily.ts` from enrich. Fire-and-forget after `commit()` returns — never inside the transaction, never as a public tRPC procedure. Missing `TAVILY_API_KEY` or `WEB_SEARCH_PROVIDER=none` → skip silently.

**Tech Stack:** Next.js 15 / tRPC v11 / Drizzle + libSQL / Vitest / existing `@wingmic/extractor` `commit()` + `fingerprint()`.

**Verify before coding (already true on `staging` as of 2026-08-20):**

```bash
rg "webSearchProviderFromEnv" apps packages --glob '*.{ts,tsx}'
# only apps/app/lib/web-search/fromEnv.ts and index.ts re-export

gh issue view 125 --json state,title
gh issue view 126 --json state,title
gh issue view 127 --json state,title
# all OPEN. #122 matchLocal also OPEN — do not block #125 on it.
```

**PR split (one change per PR, base `staging`):**

| PR | Issue | Depends on |
|---|---|---|
| A | #126 event `external_source` / `external_id` | — |
| B | #125 async person enrich after local miss | #133 (merged). #122 optional later. |
| C | #127 async event enrich (Tavily, not Brave) | PR A / #126 |

Do not squash A/B/C. Brave is dead; #127 title is stale — implement Tavily via `WebSearchProvider`.

---

## File structure

**Create (PR B):**
- `apps/app/lib/enrich/blankFacts.ts` — insert `entity_fact` only when that key is absent on the person.
- `apps/app/lib/enrich/hitsToDraft.ts` — map `WebSearchHit[]` → `PersonaDraft` (name/company from the spoken candidate; never persist vendor JSON).
- `apps/app/lib/enrich/enrichPersons.ts` — `enrichPersonsAfterCommit(...)`.
- `apps/app/lib/enrich/__tests__/blankFacts.test.ts`
- `apps/app/lib/enrich/__tests__/hitsToDraft.test.ts`
- `apps/app/lib/enrich/__tests__/enrichPersons.test.ts`

**Create (PR C):**
- `apps/app/lib/enrich/parseEventExternal.ts` — lu.ma / partiful URL → `{ source, id }`.
- `apps/app/lib/enrich/parseEventFields.ts` — date / location / official url from hits + extract text.
- `apps/app/lib/enrich/enrichEvents.ts` — `enrichEventsAfterCommit(...)`.
- `apps/app/lib/enrich/__tests__/parseEventExternal.test.ts`
- `apps/app/lib/enrich/__tests__/parseEventFields.test.ts`
- `apps/app/lib/enrich/__tests__/enrichEvents.test.ts`

**Modify:**
- PR A: `packages/db/src/schema.ts` `events` table + new drizzle migration `0006_*`.
- PR B: `packages/extractor/src/resolution.ts` `CommitResult` + per-person `created` flag; `apps/app/lib/trpc/routers/capture.ts` fire-and-forget after `commit()`; `docs/deploy.md` Tavily row (runtime effect).
- PR C: `packages/extractor/src/resolution.ts` `upsertEvent` — do **not** stamp `capturedAt` as event dates when `dateHint` is missing; `capture.ts` also fire event enrich; `docs/deploy.md`.

**Do not:**
- Call Tavily from graph search, `/search` recall, or any public tRPC query.
- First-party GET LinkedIn HTML. `extract()` already drops those URLs.
- Overwrite user-stated `entity_fact` keys or event `url` / `location` / dates that were spoken.
- Persist attendees, rosters, or vendor JSON.
- Wait for #122. Until `matchLocal` exists, “local miss” = this person row was **created** in this `commit()` (score `< 0.85` already creates a new row today).

---

## Locked rules (copy into code comments)

1. People stay `ownerUserId`-scoped. Enrich writes onto **that user's** person row only.
2. Evidence URL → `entity_fact` key `source_url` (plus optional `url` for a homepage). Confidence 70 for web-filled fields.
3. Person query needs `name+company` **or** a LinkedIn URL. Name-only → skip web (fingerprint spec tier 4).
4. `profile` intent may search LinkedIn domains; **extract** of those URLs is blocked.
5. Timeout: rely on Tavily adapter `AbortSignal.timeout(12_000)`. Enrich functions catch `WebSearchError` and return.
6. Outer deadline: wrap the whole enrich call in `Promise.race` vs 15s so capture's `void enrich...()` cannot linger unbounded.
7. `process.env` only in `apps/app/lib/config/env.ts` (already has `TAVILY_API_KEY` / `WEB_SEARCH_PROVIDER`).

---

### Task 1: PR A — event external columns (#126)

**Files:**
- Modify: `packages/db/src/schema.ts` (`events`)
- Create: `packages/db/drizzle/0006_event_external.sql` (via `bun run db:generate`, do not hand-edit an old file)
- Modify: `packages/db/drizzle/meta/_journal.json` (kit writes this)

- [ ] **Step 1: Add columns on `events`**

In `packages/db/src/schema.ts`, extend `events`:

```ts
export const events = sqliteTable(
  'event',
  {
    id: id(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    dateRangeStart: integer('date_range_start', { mode: 'timestamp' }),
    dateRangeEnd: integer('date_range_end', { mode: 'timestamp' }),
    location: text('location'),
    url: text('url'),
    externalSource: text('external_source', {
      enum: ['luma', 'partiful', 'web'],
    }),
    externalId: text('external_id'),
    observedCount: integer('observed_count').notNull().default(1),
    promotedAt: integer('promoted_at', { mode: 'timestamp' }),
    createdAt: ts('created_at'),
  },
  (t) => [
    index('event_name_idx').on(t.name),
    uniqueIndex('event_external_idx').on(t.externalSource, t.externalId),
  ],
);
```

Import `uniqueIndex` from `drizzle-orm/sqlite-core` if not already imported in this file.

SQLite unique on `(NULL, NULL)` allows many blank events — that is intended.

- [ ] **Step 2: Generate migration**

From repo root:

```bash
bun run db:generate
```

Expected: new `packages/db/drizzle/0006_*.sql` containing `ALTER TABLE event ADD ...` (or recreate — accept kit output). Never edit `0000`–`0005`.

- [ ] **Step 3: Commit PR A**

```bash
git add packages/db/src/schema.ts packages/db/drizzle
git commit -m "feat(db): event external_source and external_id for search convergence"
```

PR title: `feat(db): event external_source and external_id`  
Body: `closes #126`

---

### Task 2: PR B — per-person created flag on CommitResult

**Files:**
- Modify: `packages/extractor/src/resolution.ts`
- Modify: `packages/extractor/src/__tests__/resolution.test.ts` (assert `persons[].created`)

- [ ] **Step 1: Extend `CommitResult`**

```ts
export interface CommitPersonResolution {
  entityId: string;
  created: boolean;
  score: number | null;
}

export interface CommitResult {
  interactionId: string;
  entityIds: string[];
  companyIds: string[];
  eventIds: string[];
  topicIds: string[];
  newEntities: number;
  matchedEntities: number;
  persons: CommitPersonResolution[];
}
```

Keep `entityIds` in the same order as `extracted.persons` (already true). Push `{ entityId, created, score }` inside the person loop: `created: true` on insert; on match `created: false`, `score: match.score`.

- [ ] **Step 2: Update resolution tests**

Existing tests that check `newEntities` / `entityIds` still pass. Add:

```ts
expect(result.persons).toHaveLength(1);
expect(result.persons[0]!.created).toBe(true);
expect(result.persons[0]!.entityId).toBe(result.entityIds[0]);
```

Second commit of the same name should set `created: false` if the 0.85 path matches.

- [ ] **Step 3: Run extractor tests**

```bash
bun --filter @wingmic/extractor test
```

Expected: PASS.

- [ ] **Step 4: Commit** (same PR B as later enrich tasks, or this slice first)

```bash
git commit -m "feat(extractor): report per-person created vs matched on commit"
```

---

### Task 3: PR B — `blankFacts` + `hitsToDraft`

**Files:**
- Create: `apps/app/lib/enrich/blankFacts.ts`
- Create: `apps/app/lib/enrich/hitsToDraft.ts`
- Create: `apps/app/lib/enrich/__tests__/blankFacts.test.ts`
- Create: `apps/app/lib/enrich/__tests__/hitsToDraft.test.ts`

- [ ] **Step 1: Failing tests**

`blankFacts.test.ts` — in-memory libSQL (copy the CREATE TABLE `entity_fact` / `entity` setup from `apps/app/lib/trpc/routers/entity.test.ts`). Seed Ada with `email` already set. Call `insertBlankFacts` with `email`, `url`, `source_url`. Assert email unchanged, url + source_url inserted, confidence 70.

`hitsToDraft.test.ts`:

```ts
import { hitsToPersonaDraft } from '../hitsToDraft';

it('takes homepage url from a non-linkedin hit and never stores vendor json', () => {
  const draft = hitsToPersonaDraft(
    { name: 'Ada Lovelace', companyHint: 'Analytical Engines' },
    [
      {
        title: 'Ada Lovelace — Analytical Engines',
        url: 'https://www.analytical-engines.example/people/ada',
        snippet: 'Ada Lovelace, mathematician at Analytical Engines.',
      },
      {
        title: 'Ada | LinkedIn',
        url: 'https://www.linkedin.com/in/ada-lovelace',
        snippet: 'View Ada Lovelace’s profile',
      },
    ],
  );
  expect(draft.name).toBe('Ada Lovelace');
  expect(draft.companyHint).toBe('Analytical Engines');
  expect(draft.sourceUrl).toBe('https://www.analytical-engines.example/people/ada');
  expect(draft.linkedin).toBe('https://www.linkedin.com/in/ada-lovelace');
  expect(JSON.stringify(draft).includes('View Ada')).toBe(false);
});
```

- [ ] **Step 2: Run — fail**

```bash
bun --filter @wingmic/app test -- lib/enrich
```

Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

`blankFacts.ts`:

```ts
import { and, eq, inArray } from 'drizzle-orm';
import type { DB } from '@wingmic/db';
import * as schema from '@wingmic/db/schema';

export type BlankFact = { key: string; value: string; confidence: number };

export async function insertBlankFacts(
  db: DB,
  entityId: string,
  facts: BlankFact[],
  sourceInteractionId: string | null,
): Promise<string[]> {
  if (facts.length === 0) return [];
  const keys = facts.map((f) => f.key);
  const existing = await db.query.entityFacts.findMany({
    where: and(
      eq(schema.entityFacts.entityId, entityId),
      inArray(schema.entityFacts.key, keys),
    ),
    columns: { key: true },
  });
  const have = new Set(existing.map((r) => r.key));
  const fresh = facts.filter((f) => f.value.trim() && !have.has(f.key));
  if (fresh.length === 0) return [];
  await db.insert(schema.entityFacts).values(
    fresh.map((f) => ({
      entityId,
      key: f.key,
      value: f.value.trim(),
      confidence: f.confidence,
      sourceInteractionId,
    })),
  );
  return fresh.map((f) => f.key);
}
```

`hitsToDraft.ts` — spoken name/company win; LinkedIn URL from a linkedin host hit via `canonicalizeLinkedin`; `sourceUrl` = first non-blocked non-linkedin http(s) url; do not copy snippets onto `notes`.

- [ ] **Step 4: Run — pass**

```bash
bun --filter @wingmic/app test -- lib/enrich
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(enrich): blank fact insert and hit-to-draft mapping"
```

---

### Task 4: PR B — `enrichPersonsAfterCommit` + capture hook

**Files:**
- Create: `apps/app/lib/enrich/enrichPersons.ts`
- Create: `apps/app/lib/enrich/__tests__/enrichPersons.test.ts`
- Modify: `apps/app/lib/trpc/routers/capture.ts` (after `commit()`, before `return`)
- Modify: `docs/deploy.md` Tavily row

- [ ] **Step 1: Failing test with a mock provider**

Do **not** hit `api.tavily.com`. Pass a fake `WebSearchProvider`:

```ts
const provider: WebSearchProvider = {
  id: 'tavily',
  search: async () => [
    {
      title: 'Ada Lovelace',
      url: 'https://www.analytical-engines.example/ada',
      snippet: 'mathematician',
    },
  ],
  extract: async () => [],
};

await enrichPersonsAfterCommit({
  db,
  userId: 'user_e2',
  interactionId: 'it_1',
  extractedPersons: [
    { name: 'Ada Lovelace', companyHint: 'Analytical Engines', topics: [], aliases: [] },
  ],
  persons: [{ entityId: 'en_ada', created: true, score: null }],
  provider,
});
// assert entity_fact url + source_url on en_ada
// created: false → search() not called
// name-only (no companyHint, no linkedin) → search() not called
```

Also: `provider = null` → no throw, no writes.

- [ ] **Step 2: Implement `enrichPersonsAfterCommit`**

```ts
export async function enrichPersonsAfterCommit(opts: {
  db: DB;
  userId: string;
  interactionId: string;
  extractedPersons: PersonCandidate[];
  persons: CommitPersonResolution[];
  provider: WebSearchProvider | null;
}): Promise<void>
```

Logic:
1. If `!provider` return.
2. Zip `extractedPersons` with `opts.persons` by index. Skip if `!created`.
3. Load the entity; skip if `ownerUserId !== userId` or `deletedAt` set.
4. `buildWebSearchQuery({ intent: 'person', name, company })` — skip if `q` is empty or name-only (no `companyHint` and no `linkedin`).
5. `hits = await provider.search(query)`.
6. `draft = hitsToPersonaDraft(person, hits)`.
7. Optional: `extract` on `draft.sourceUrl` if present and `!isBlockedExtractUrl`. Use extract text only to pick a cleaner homepage title/url — still no LinkedIn extract.
8. `insertBlankFacts` for: `url` (homepage), `source_url`, `linkedin` (canonical), never `email` from a guessed snippet unless the snippet contains an explicit `mailto` / `name@domain` **and** you add a tight regex test. Default: **do not** write email from web in v1 (too easy to get wrong). Fingerprint: if `fingerprint(draft).kind` is strong, also insert `fingerprint` key if blank.
9. Catch all errors; never throw to capture.

- [ ] **Step 3: Hook capture (not a tRPC procedure)**

In `apps/app/lib/trpc/routers/capture.ts` after successful `commit()` (same place as acts insert — **after** the transaction, **not** blocking the JSON response more than a microtask):

```ts
import { webSearchProviderFromEnv } from '@/lib/web-search';
import { enrichPersonsAfterCommit } from '@/lib/enrich/enrichPersons';

const provider = webSearchProviderFromEnv();
if (provider) {
  void Promise.race([
    enrichPersonsAfterCommit({
      db: ctx.db,
      userId: ctx.user.id,
      interactionId: result.interactionId,
      extractedPersons: extracted.persons,
      persons: result.persons,
      provider,
    }),
    new Promise<void>((resolve) => setTimeout(resolve, 15_000)),
  ]).catch(() => {
    // capture already succeeded
  });
}
```

Do **not** `await` this in the mutation. Acts insert may stay `await` as today.

- [ ] **Step 4: Docs**

In `docs/deploy.md`, change the Tavily row from “no runtime effect until wiring lands” to: used after `capture.commit` for person (and later event) enrich; missing key skips.

- [ ] **Step 5: Tests + commit**

```bash
bun --filter @wingmic/app test -- lib/enrich
bun --filter @wingmic/extractor test
git commit -m "feat(capture): async tavily enrich after local person miss"
```

PR title: `feat(capture): async tavily enrich after local person miss`  
Body: `closes #125`. Note #122 still open; this PR uses `created` as the miss signal.

---

### Task 5: PR C — stop stamping capturedAt as event dates

**Why:** `upsertEvent` today sets `dateRangeStart/End = capturedAt` when there is no `dateHint`. #127 “skip if dates already set” would then **never** fill real conference dates.

**Files:**
- Modify: `packages/extractor/src/resolution.ts` `upsertEvent`
- Modify: extractor event tests if any

- [ ] **Step 1: Test**

Commit a memo that names an event without a date hint. Assert `dateRangeStart` and `dateRangeEnd` are `null`. With `dateHint: '2026-02-27'` assert those timestamps.

- [ ] **Step 2: Implement**

```ts
const dateGuess =
  e.dateHint && /^\d{4}-\d{2}-\d{2}/.test(e.dateHint) ? new Date(e.dateHint) : null;

// on insert:
dateRangeStart: dateGuess,
dateRangeEnd: dateGuess,
```

On existing row: still do not overwrite dates/location/url (observedCount bump only), matching “never overwrite user-stated / already-filled”.

- [ ] **Step 3: Commit** (start of PR C)

```bash
git commit -m "fix(extractor): leave event dates blank when speech has no date"
```

---

### Task 6: PR C — parse luma/partiful + event fields

**Files:**
- Create: `apps/app/lib/enrich/parseEventExternal.ts`
- Create: `apps/app/lib/enrich/parseEventFields.ts`
- Tests beside them

- [ ] **Step 1: Tests**

```ts
expect(parseEventExternal('https://lu.ma/abc123')).toEqual({
  source: 'luma',
  id: 'abc123',
});
expect(parseEventExternal('https://partiful.com/e/xyz')).toEqual({
  source: 'partiful',
  id: 'xyz',
});
expect(parseEventExternal('https://www.ethdenver.com')).toBeNull();
```

Field parser: given hits titled “ETH Denver 2026” with snippet “Feb 27 – Mar 1, 2026 · Denver” and url `https://www.ethdenver.com`, return `{ url, location: 'Denver', dateRangeStart, dateRangeEnd }` (ISO dates at UTC midnight is fine). Recurring private names with empty/unrelated hits → all nulls.

- [ ] **Step 2: Implement parsers** (no network). Prefer official site over ticket resellers. Skip `isBlockedExtractUrl` urls.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(enrich): parse luma/partiful ids and event blanks from search hits"
```

---

### Task 7: PR C — `enrichEventsAfterCommit` + capture hook

**Files:**
- Create: `apps/app/lib/enrich/enrichEvents.ts`
- Create: `apps/app/lib/enrich/__tests__/enrichEvents.test.ts`
- Modify: `apps/app/lib/trpc/routers/capture.ts`

- [ ] **Step 1: Failing test**

In-memory db with event `ev_eth` name `ETH Denver`, null dates/url/location. Mock provider returns official site + dates in snippet. After enrich: url, location, dates set; `externalSource` still null. Second test: snippet contains `https://lu.ma/ethdenver` → `externalSource: 'luma'`, `externalId` set. Third: event already has url + both dates → `search` not called. Fourth: `provider: null` → no-op.

Never insert `entity_event` rows for other people. Never write attendee names.

- [ ] **Step 2: Implement**

```ts
export async function enrichEventsAfterCommit(opts: {
  db: DB;
  eventIds: string[];
  capturedAt: Date;
  provider: WebSearchProvider | null;
}): Promise<void>
```

For each id:
1. Load event. Skip if missing.
2. Skip if `url` and `dateRangeStart` and `dateRangeEnd` are all set (location-only blank may still fill location).
3. Year hint: `String(capturedAt.getUTCFullYear())` if the name has no year.
4. `search({ intent: 'event', q: buildWebSearchQuery({ intent: 'event', event: name, year }).q })`.
5. Parse hits; optionally `extract` the chosen official url (not LinkedIn).
6. Update **only null columns**. Confidence is implicit (no confidence column on `event`). Set `external_*` only if both currently null and a luma/partiful url appeared.

- [ ] **Step 3: Capture hook**

Same `void Promise.race` pattern, **separate** from person enrich (either can fail). `eventIds: result.eventIds`.

- [ ] **Step 4: Docs + verify**

```bash
rg "webSearchProviderFromEnv" apps/app --glob '*.ts'
# fromEnv.ts, capture.ts (and only those product files)

bun --filter @wingmic/app test -- lib/enrich
bun --filter @wingmic/extractor test
bun run typecheck && bun run lint && bun run test
```

```bash
git commit -m "feat(events): async tavily enrich fills blank event date location url"
```

PR title: `feat(events): tavily enrich fills blank event date, location, url`  
Body: `closes #127`. State Brave is not used.

---

## Out of scope (do not do in these PRs)

- #122 `matchLocal` strong-key merge (email/linkedin before fuzzy). After it lands, change the #125 gate from `created` to `matchLocal === miss | ambiguous`.
- #124 duplicate Tavily adapter ticket — already shipped as #132/#133.
- Graph canvas search, `/search` embeddings, LinkedIn OAuth.
- `packages/enrich` extraction — stay in `apps/app/lib/enrich` until import also consumes it.
- Filling person email from web snippets.
- Tab bar / chat composer / person-list chrome — those are product UI bugs, not this enrich work.

## How you will know Tavily is live (after PR B/C, not before)

1. Railway has `TAVILY_API_KEY` and `WEB_SEARCH_PROVIDER` is not `none`.
2. Tavily dashboard usage increments **after a capture that creates a new person with name+company** (or an event with blank dates/url).
3. Graph typeahead and `/search` still never call Tavily.
