# Product analytics (PostHog)

Growth instrumentation from first capture to habitual query — the "Analytics"
section of the product & architecture spec (`art_LkglG0Xb`).

- **Capture path:** server-side only, via [`posthog-node`](https://posthog.com/docs/libraries/node)
  (`apps/app/lib/analytics/server.ts`). No client SDK ships and no taxonomy
  event originates in the browser — every taxonomy event is observable
  server-side, and this keeps the browser bundle free of a third-party script.
- **Single source of truth:** `apps/app/lib/analytics/events.ts` holds the
  locked twelve-event taxonomy — the seven capture/query events plus the five
  bay-funnel events from the merged-product spec (`art_9Ii0l0LU`, locked
  decision #7) — and the per-event property shapes. The taxonomy test
  (`lib/analytics/__tests__/taxonomy.test.ts`) fails if any event loses
  its instrumentation point or a payload starts carrying PII.
- **No-op contract:** without `POSTHOG_KEY` (or `NEXT_PUBLIC_POSTHOG_KEY`)
  analytics is completely silent — zero-secrets boot, local dev, and tests
  emit nothing. `POSTHOG_HOST` defaults to `https://us.i.posthog.com`; set it
  to `https://eu.i.posthog.com` for EU cloud or a reverse proxy.

## Locked event taxonomy

| Event               | Fires when                                                            | Instrumentation point                          | Properties |
| ------------------- | --------------------------------------------------------------------- | ---------------------------------------------- | ---------- |
| `capture_started`   | a capture turn enters the commit pipeline                             | `lib/trpc/routers/capture.ts` → `commit`       | `hasAttachment`, `hasParent`, `hasTarget` |
| `capture_completed` | the capture committed to the graph (incl. idempotent-retry duplicates)| `lib/trpc/routers/capture.ts` → `commit`       | `duplicate`, `hasAttachment`, `newEntities`, `matchedEntities`, `actions`, `actsPending`, `durationMs` |
| `entity_created`    | the graph grew on a fresh commit                                      | `lib/trpc/routers/capture.ts` → `commit`       | `newEntities`, `matchedEntities`, `persons`, `companies`, `events`, `topics` |
| `enrichment_run`    | one background enrichment unit finished (success **or** failure)      | `lib/enrich/enrichPersons.ts`, `lib/enrich/enrichEvents.ts` | `kind` (`person`\|`event`), `status` (`ok`\|`error`), `fields` |
| `search_run`        | one recall query completed (semantic or text fallback, zero-result too)| `lib/trpc/routers/recall.ts` → `query`        | `mode` (`semantic`\|`text`), `results`, `durationMs` |
| `api_call`          | an authenticated `/api/v1` request completed (200/403/429/5xx with a valid key; 401s stay silent) | `lib/api/server.ts` → `withApiKey` | `method`, `route` (static path), `scope`, `status` |
| `signup`            | a BetterAuth user row is created (magic link is the only auth method) | `lib/auth.ts` → `databaseHooks.user.create.after` | `method` (`magic_link`) |
| `map_view`          | the /bay map rendered for a visitor                                   | `app/bay/page.tsx` server render — **pending**: the surface PR owns that file; pinned in `PENDING_INSTRUMENTATION` | `signedIn`, `persona` |
| `ask_run`           | an accepted ask entered the bay pipeline (after the rate/persona guards — 429 noise is not product signal) | `lib/trpc/routers/bay.ts` → `ask` | `signedIn`, `hasClientProfile`, `persona` |
| `event_opened`      | a bay event detail fetch resolved (live **or** expired history — a retained card read is still a read) | `lib/trpc/routers/bay.ts` → score-path detail resolution | `source`, `live` |
| `score_shown`       | a bay score returned ok (a score was actually shown)                  | `lib/trpc/routers/bay.ts` → `score` | `signedIn`, `verdict` (`go`\|`maybe`\|`skip`), `scorer` (`typed`\|`llm`), `profileKind` (`pasted`\|`throwaway`\|`wingmic`), `profileQuality` (`ok`\|`thin`\|`none`), `ai`, `persona` |
| `claim_started`     | a signed-in viewer started claiming a throwaway profile into the graph | `lib/trpc/routers/bay.ts` → `claim` | `submittedKind` (`text`\|`structured`), `hasLinks` |

Notes on granularity choices:

- `api_call` is per static endpoint (`/api/v1` has no dynamic segments, so the
  pathname is a bounded enum) — switch to per-scope aggregation by dropping the
  `route` property if cardinality ever matters.
- `enrichment_run` covers both provider-backed enrichment units (person web
  lookup, event field patch) and both code paths (post-commit background batch
  and the `entities.enrich` retry mutation). Extend `kind` only as a spec change.

### The bay funnel (merged-product spec)

The bay is anonymous-first (locked decision #3): **no server principal exists
before claim**, so signed-out funnel events share one fixed, PII-free
`distinctId` bucket (`bay_anonymous`, in the bay router). The anonymous
funnel is a shape, not a person. `claim_started` is the join point: it fires
on the real user id, and its internal capture rides the capture funnel
(`capture_started` → `capture_completed` → `entity_created`), which is how a
claimed profile enters the graph exactly once.

- `map_view` is pinned in `PENDING_INSTRUMENTATION` until the /bay surface PR
  lands its server-component render (this task must not touch surface UI).
  The taxonomy test enforces every other event today and `map_view` the
  moment its call site exists.
- `event_opened` fires on expired history too (`live: false`) — retained
  history answering honestly is part of the product, not an error state.
- `claim_started` fires at the very top of the mutation, **before profile
  parsing**, so unparseable attempts still register. Its `submittedKind`
  describes the submission shape; the resolved core kind lands separately on
  `score_shown.profileKind` — two properties, two meanings, no collisions.

## Privacy

- `distinctId` is the opaque BetterAuth user id — never the email. Signed-out
  bay funnel events share one fixed, PII-free bucket id (`bay_anonymous`):
  no server principal exists before claim, so there is nothing to personalize
  and the anonymous funnel cannot be a person.
- No `identify`/personization calls anywhere; profiles stay anonymous except
  for the id.
- Properties are booleans, small counts, and fixed enums only — no emails,
  names, or message/transcript content. `sanitizeAnalyticsProperties` is the
  structural backstop (primitives only, ≤12 properties, strings truncated to
  64 chars), and the taxonomy test scans payloads for PII-shaped strings.
- Events are fire-and-forget: analytics failures are logged, never thrown, and
  never block a product path.

## Dashboard setup (PostHog UI)

Create a "Wingmic growth" dashboard with the two spec insights:

### 1. Capture → habitual-query funnel (Funnel insight)

1. New insight → **Funnel**.
2. Step 1: event `capture_started`.
3. Step 2: event `capture_completed`.
4. Step 3: event `search_run` — conversion window **7 days** (the "habitual
   query" threshold; widen if activation conversations move).
5. Breakdown: `capture_started.hasAttachment` (voice/photo vs text capture
   activation), and a second copy broken down by `capture_started.hasTarget`.
6. Optional guardrail funnel: `signup` → `capture_started` → `search_run` to
   see new-user activation end-to-end.

Expected reading: `capture_started` → `capture_completed` is the reliability
metric (drops here = pipeline/extraction failures); `capture_completed` →
`search_run` is the habit metric (drops here = recall value not landing).

### 2. Retention by cohort (Retention insight)

1. New insight → **Retention**.
2. Cohortizing event: `signup` (period: **Week**).
3. Returning event: `search_run` (habitual query recurrence). A second
   retention chart with returning event `capture_completed` shows capture
   habit retention separately.
4. Read weeks 1–8; the spec's compounding thesis ("come for the map, stay for
   the network") is confirmed when week-4 `search_run` retention trends up.

### 3. Health widgets (optional but recommended)

- **Trend:** `enrichment_run` with breakdown `status` — an `error` share
  above ~10% means the enrichment provider is degraded (post-commit
  enrichment is asynchronous, so users never see these failures directly).
- **Trend:** `api_call` with breakdown `route`, filtered `status = 429` —
  key rate-limit pressure.
- **Trend:** `search_run` with breakdown `mode` — a rising `text` share means
  embeddings are degrading to the keyword fallback.

### 4. Bay map funnel (two recipes — the id spaces do not chain)

The bay is anonymous-first, and its funnel does **not** live in one PostHog
Funnel: signed-out events all share one aggregate person (`bay_anonymous`)
while `claim_started` fires on the claimer's real user id, and no
identify/alias call stitches the two — deliberately (see Privacy). A funnel
step chains per-person by `distinctId`, so the claim step cannot chain from
the anonymous person: a single funnel ending at `claim_started` would read
~0% on its final transition for exactly the population it exists to measure.
Two recipes instead:

**Anonymous shape funnel (Funnel insight):**

1. New insight → **Funnel**.
2. Step 1: event `map_view` — until the bay surface PR lands, build this from
   `ask_run` onward (`map_view` does not fire yet; see `PENDING_INSTRUMENTATION`).
3. Step 2: `ask_run` — the visitor asked the map a question.
4. Step 3: `event_opened` — a card was read.
5. Step 4: `score_shown` — a score was actually shown.

Read this as the **shape of a visit**, not per-person conversion: with one
aggregate person the step totals measure event volume, the conversion
percentages carry no unique-visitor meaning, and no conversion window is
per-person either. The honest signals are the volume ratios between steps —
a rising `ask_run` → `event_opened` drop is an answer-relevance smell; a
rising `event_opened` → `score_shown` drop is profile friction (scoring
needs a viewer profile, and this is where it leaks).

**Claim ratio (Trend insight) — the thesis metric:**

- Trend of `claim_started` count divided by `score_shown` count — the
  aggregate stand-in for anonymous → claim conversion, since the transition
  itself cannot chain inside a funnel. If a stitched per-person view ever
  becomes necessary, that is an aliasing design decision (spec change), not
  a dashboard tweak.
- Break down `claim_started` by its own `submittedKind` (paste vs structured
  claim shapes). Put the score-side breakdowns (`profileQuality`,
  `profileKind`) on separate trends — a `claim_started` step cannot break
  down by properties its payloads do not carry.

### 5. Event score quality (Trend insights)

- **Trend:** `score_shown` with breakdown `verdict` — the go/maybe/skip mix
  over inventory. A drift toward `skip` means inventory or personas went stale
  (cross-check against the ingest freshness widget below).
- **Trend:** `score_shown` with breakdown `scorer` — a rising `typed` share
  means the LLM explainer is degraded and deterministic fallback templates
  carried the wording (honest, but blander — worth a look at the AI gateway).
- **Trend:** `event_opened` with breakdown `live` — the `live: false` share
  is how often visitors hit retained history; a rising share smells like a
  stalled nightly ingest rather than curious browsing.
- **Trend:** `score_shown` with breakdown `profileKind` — the anonymous
  `throwaway` vs signed-in `wingmic` split measures how much of the scorer's
  work happens before anyone has an account.
- **Trend:** `claim_started` with breakdown `submittedKind` — paste vs
  structured-field claim shapes, for the claim UX iteration.

## Adding or changing an event

The taxonomy is locked at twelve events — seven from the growth spec
(`art_LkglG0Xb`, locked decision #9) and five bay-funnel events from the
merged-product spec (`art_9Ii0l0LU`, locked decision #7). Changes:

1. Update `ANALYTICS_EVENTS` + the property type in `lib/analytics/events.ts`
   (never bypass the module — call sites must import from it).
2. Extend the taxonomy test's surface drivers if a new event is added.
3. Update the table above and the funnel/dashboard notes.

## Local verification

- `bun run test --filter=@wingmic/app` runs the taxonomy test: every locked
  event must fire from its instrumentation point with a mocked PostHog
  client, and payloads must stay PII-free.
- To see live events locally, set `POSTHOG_KEY` to a PostHog project key (or
  point `POSTHOG_HOST` at a local proxy) and capture something; events appear
  in the PostHog Live events feed within seconds.
