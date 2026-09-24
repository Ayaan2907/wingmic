# Product analytics (PostHog)

Growth instrumentation from first capture to habitual query — the "Analytics"
section of the product & architecture spec (`art_LkglG0Xb`).

- **Capture path:** server-side only, via [`posthog-node`](https://posthog.com/docs/libraries/node)
  (`apps/app/lib/analytics/server.ts`). No client SDK ships and no taxonomy
  event originates in the browser — every taxonomy event is observable
  server-side, and this keeps the browser bundle free of a third-party script.
- **Single source of truth:** `apps/app/lib/analytics/events.ts` holds the
  locked seven-event taxonomy and the per-event property shapes. The taxonomy
  test (`lib/analytics/__tests__/taxonomy.test.ts`) fails if any event loses
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

Notes on granularity choices:

- `api_call` is per static endpoint (`/api/v1` has no dynamic segments, so the
  pathname is a bounded enum) — switch to per-scope aggregation by dropping the
  `route` property if cardinality ever matters.
- `enrichment_run` covers both provider-backed enrichment units (person web
  lookup, event field patch) and both code paths (post-commit background batch
  and the `entities.enrich` retry mutation). Extend `kind` only as a spec change.

## Privacy

- `distinctId` is the opaque BetterAuth user id — never the email.
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

## Adding or changing an event

The taxonomy is locked at seven events (spec, locked decision #9). Changes:

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
