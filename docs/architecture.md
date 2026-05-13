# architecture

How wingmic actually works under the hood. Read this before touching the schema, the extractor, or the recall pipeline.

---

## table of contents

0. [Monorepo layout](#-0-monorepo-layout)
1. [The mental model](#1-the-mental-model)
2. [Framing D: the identity model](#2-framing-d-the-identity-model)
3. [Schema map](#3-schema-map)
4. [Capture flow](#4-capture-flow)
5. [Recall flow](#5-recall-flow)
6. [Resolution: confidence + lazy promotion](#6-resolution-confidence--lazy-promotion)
7. [Failure modes](#7-failure-modes)
8. [Why these choices](#8-why-these-choices)

---

## § 0 monorepo layout

Wingmic is a Turborepo monorepo with two Next.js apps and shared packages.

```
apps/
  web/                ← static landing → wingmic.xyz
  app/                ← dynamic product → app.wingmic.xyz
packages/
  brand               ← brand assets (logos, favicons, OG, manifest)
  design-tokens       ← Tailwind preset + token TS
  db                  ← Drizzle + libSQL + migrations + client
  extractor           ← entity-detection: Zod schema + Claude prompt + embeddings + resolution + eval
  config/             ← shared tsconfig, eslint, vitest presets
```

`apps/web` is pure-static — no DB import, no auth code, no API routes. It deploys to Cloudflare Pages as static assets, accepts zero secrets.

`apps/app` is dynamic — runs on Cloudflare Workers via @opennextjs/cloudflare. Handles authentication (BetterAuth + Resend magic link, cookie scoped to `app.wingmic.xyz`), capture, recall, dashboard, tRPC API.

Shared code lives in `packages/*` and is consumed by `apps/app`. `apps/web` only consumes `@wingmic/brand` and `@wingmic/design-tokens` — never `@wingmic/db` or `@wingmic/extractor` (would defeat the static promise).

---

## 1. the mental model

Wingmic is two things in a trench coat:

1. A **personal CRM** — your private graph of people you know and the context you have on them.
2. A **shared canonical layer** for the public facts those people exist within (companies, events, topics).

Most "AI CRMs" conflate the two. Wingmic separates them on purpose — each has different identity properties, privacy needs, and update patterns.

```
                 ┌─────────────────────────────────────┐
                 │           CANONICAL LAYER           │
                 │  (shared across all wingmic users)  │
                 │                                     │
                 │     company   event    topic        │
                 │       │         │        │          │
                 └───────┼─────────┼────────┼──────────┘
                         │         │        │
                         │ edges   │        │
                         │         │        │
                 ┌───────┼─────────┼────────┼──────────┐
                 │           PERSONAL LAYER            │
                 │       (private to each user)        │
                 │                                     │
                 │     entity (Person)                 │
                 │       │  └── facts, notes           │
                 │     interaction                     │
                 │     identity_claim                  │
                 │     entity_resolution               │
                 │                                     │
                 └─────────────────────────────────────┘
```

---

## 2. Framing D: the identity model

We considered four framings for "how does wingmic relate users to the entities they capture?":

| Framing | What it is | Why we didn't pick it |
|---|---|---|
| A — Pure private CRM | Each graph siloed forever | Loses network effect; imports stay dumb |
| B — Auto-linking social network | Verified IDs auto-resolve users | Privacy nightmare; consent surface huge; marketing whiplash |
| C — Siloed default + opt-in linking for everyone | Everything starts private, optional consent | Forces consent for *companies and events* which are public facts |
| **D — Per-kind identity** | People private; companies/events/topics canonical | ✅ the one we shipped |

**The key insight:** companies and events are *public facts about the world*. Acme has 500 employees regardless of who knows about it. AWS re:Invent 2026 happened in Las Vegas regardless of who attended. Sharing those across users needs **no consent** — they're already public.

People are different. Your relationship with Sarah is *yours*. Sharing facts about Sarah across users without her permission is a GDPR violation waiting to happen.

So:

- **People (entity, kind=person)** — private, scoped to `ownerUserId`, opt-in linking via `identity_claim` + `entity_resolution` (UI exposed in v0.2+, schema present in v0.1.1).
- **Companies, events, topics** — canonical and shared. **Lazy promotion**: a row is created on first observation by any user, with `observed_count = 1`. When a second user captures the same one, `observed_count` increments and `promoted_at` is set, marking it as a real canonical entry. Until promotion, it behaves as a private stub.

This means v0.1.1 is **user-facing identical to Framing A** — every user just sees their own graph, no cross-user surfaces — but the schema is **forward-compatible** with the v0.2 social opt-in.

---

## 3. schema map

Full schema lives in [`packages/db/src/schema.ts`](../packages/db/src/schema.ts) (exported via `@wingmic/db`). 17 tables.

### user layer (BetterAuth-managed core + wingmic identity)

| table | purpose |
|---|---|
| `user` | core user (BetterAuth + wingmic) |
| `session` | BetterAuth session tokens |
| `account` | BetterAuth provider accounts |
| `verification` | BetterAuth magic-link tokens |
| `identity_claim` | proven email/linkedin/etc. for v0.2 opt-in linking |

### canonical layer (shared, lazy-promoted)

| table | purpose |
|---|---|
| `company` | name, domain, slug, observed_count, promoted_at |
| `event` | name, slug, date_range, location, observed_count, promoted_at |
| `topic` | shared vocabulary (rust, edge runtime, …), aliases JSON |

### personal layer (owner_user_id-scoped, private)

| table | purpose |
|---|---|
| `entity` | a Person you've captured. Has an `embedding F32_BLOB(1536)` |
| `entity_resolution` | candidate links to platform-user accounts |
| `interaction` | a single capture: transcript + captured_at + embedding |
| `entity_fact` | key/value facts about an entity (email, linkedin, free-form notes), each with embedding + confidence |
| `entity_note` | free-form per-user notes (separate from auto-extracted facts) |

### cross-layer edges

| table | purpose |
|---|---|
| `entity_company` | "Sarah works at Acme" — entity_id × company_id × role |
| `entity_event` | "met Sarah at re:Invent" — entity_id × event_id |
| `entity_topic` | "Sarah is associated with rust" — entity_id × topic_id × weight |

### v0.2-ready

| table | purpose |
|---|---|
| `connection_request` | the opt-in linking request flow (UI hidden until v0.2) |

---

## 4. capture flow

All capture stages run inside `apps/app` (the dynamic product on Workers); `apps/web` is static landing only.

```
 voice
   │
   ▼
 ┌──────────────────────────────────────────────────┐
 │  Browser SpeechRecognition (or BYO STT in v0.1.2)│
 │  Continuous mode, interim + final result paths   │
 │  apps/app/app/capture/_components/useSpeechRecognition.ts
 └─────────────────┬────────────────────────────────┘
                   │ transcript (string)
                   ▼
 ┌──────────────────────────────────────────────────┐
 │  trpc capture.commit (protected procedure)       │
 │  apps/app/lib/trpc/routers/capture.ts            │
 └─────────────────┬────────────────────────────────┘
                   │
                   ▼
 ┌──────────────────────────────────────────────────┐
 │  extract(transcript)                             │
 │  @wingmic/extractor → src/client.ts              │
 │   • Vercel AI SDK generateObject                 │
 │   • Anthropic Claude Sonnet 4.6                  │
 │   • Zod schema (ExtractionResult)                │
 │   → { persons[], companies[], events[],          │
 │       topics[], actions[] }                       │
 └─────────────────┬────────────────────────────────┘
                   │
                   ▼
 ┌──────────────────────────────────────────────────┐
 │  embedTexts(personDescriptors) +                 │
 │  embedText(transcript)                           │
 │  @wingmic/extractor → src/embeddings.ts          │
 │   • OpenAI text-embedding-3-small (1536-d)       │
 └─────────────────┬────────────────────────────────┘
                   │
                   ▼
 ┌──────────────────────────────────────────────────┐
 │  commit(extracted, ctx)                          │
 │  @wingmic/extractor → src/resolution.ts          │
 │  (writes via @wingmic/db client)                  │
 │                                                   │
 │  1. upsert canonical Company (slug + domain)      │
 │     observed_count++; promotedAt set at count≥2   │
 │  2. upsert canonical Event (slug + date)          │
 │  3. upsert canonical Topic (exact slug)           │
 │  4. resolve Person against owner's entities       │
 │     score = 0.55*name + 0.25*embed + 0.2*company  │
 │     ≥0.85 → link, <0.85 → create new              │
 │  5. persist Interaction with full embedding       │
 │  6. wire EntityCompany / EntityEvent / EntityTopic│
 │  7. persist email / linkedin / notes as facts     │
 └─────────────────┬────────────────────────────────┘
                   │
                   ▼
 ┌──────────────────────────────────────────────────┐
 │  CommitResult { interactionId, entityIds[],      │
 │    newEntities, matchedEntities, … }             │
 │  rendered in CaptureClient.tsx ResultPane        │
 └──────────────────────────────────────────────────┘
```

---

## 5. recall flow

Runs in `apps/app`, same as capture.

```
 user types: "who at acme works on rust?"
   │
   ▼
 ┌──────────────────────────────────────────────────┐
 │  trpc recall.query                               │
 │  apps/app/lib/trpc/routers/recall.ts             │
 └─────────────────┬────────────────────────────────┘
                   │
                   ▼
 ┌──────────────────────────────────────────────────┐
 │  embedText(q)                                     │
 │  → 1536-d query vector                            │
 └─────────────────┬────────────────────────────────┘
                   │
                   ▼
 ┌──────────────────────────────────────────────────┐
 │  pull this user's entities (with embeddings)     │
 │  cosine similarity in JS, sort desc, take top N  │
 │                                                   │
 │  v0.1.1: in-memory cosine — fine at <5k entities  │
 │  v0.2:    swap to libSQL `vector_top_k(idx, q, k)`│
 └─────────────────┬────────────────────────────────┘
                   │
                   ▼
 ┌──────────────────────────────────────────────────┐
 │  hydrate edges (parallel queries):               │
 │   • entity_company → company                      │
 │   • entity_event → event                          │
 │   • entity_facts (top 5 by confidence)           │
 │   • entity_topic → topic                          │
 └─────────────────┬────────────────────────────────┘
                   │
                   ▼
 ┌──────────────────────────────────────────────────┐
 │  return { entities[], durationMs }               │
 │  rendered in RecallClient.tsx ResultCard         │
 └──────────────────────────────────────────────────┘
```

---

## 6. resolution: confidence + lazy promotion

### Person resolution

```
For each PersonCandidate from Claude:
  Pull all entities owned by this user.
  For each existing entity:
    nameScore = max(nameSimilarity(cand.name, entity.name),
                    nameSimilarity(cand.name, alias) for alias in entity.aliases)
    embedScore = cosine(entity.embedding, cand.embedding) (0..1, clamped)
    companyBoost = 0.0  (reserved; v0.2 wires actual entity_company joins)

    score = 0.55 * nameScore + 0.25 * embedScore + 0.2 * companyBoost

  Take the best score.
  If score ≥ 0.85 → LINK to existing entity, refresh its embedding
  Else            → CREATE a new entity with this candidate's data
```

The threshold (`0.85`) is tunable. Future work: prompt the user to confirm in the 0.5–0.85 range instead of always-creating.

### Lazy canonical promotion

Companies and events use the same pattern:

```
On capture of "Acme":
  slug = slugify("Acme") = "acme"
  existing = company where slug = "acme" or domain matches hint

  if existing:
    existing.observed_count += 1
    if existing.observed_count >= 2 and not existing.promoted_at:
      existing.promoted_at = now()
  else:
    create company { slug, name, domain, observed_count=1, promoted_at=null }
```

A company / event with `promoted_at IS NULL` is functionally a private stub. Once two users have observed it independently, it becomes shared canonical reality.

---

## 7. failure modes

We trace these explicitly so the team knows where to look when something breaks.

| Failure | Detection | Mitigation |
|---|---|---|
| Browser SpeechRecognition silently fails on iOS Safari | 5s timeout with no result event | Show "type instead" toast; reveal text fallback (planned v0.1.2) |
| Anthropic 429 rate limit | TRPCError caught in `capture.commit` | Save raw transcript to `interaction`, surface "saved as draft, will retry" (planned v0.1.2) |
| Zod schema rejection on Claude output | `ExtractionError` from `@wingmic/extractor` | Caller retries once with stricter prompt; if still bad, save transcript only |
| Turso replica lag | Read returns stale rows | Default to primary for 30s after writes (planned v0.1.2) |
| Magic link expired mid-capture | tRPC UNAUTHORIZED on commit | Stash transcript in localStorage, prompt re-auth, replay after (planned v0.1.2) |

---

## 8. why these choices

### Why Drizzle + libSQL/Turso (not Prisma + Postgres)?

- **Edge-native.** Drizzle's runtime is ~50 KB; Prisma's is ~5 MB. libSQL replicas at the edge mean p50 read latency is global.
- **One SQLite file holds the whole graph + vectors.** No separate vector DB (Pinecone, Weaviate). No separate cache.
- **Turso free tier is genuinely generous.** Millions of rows, ~9 GB storage, plenty for v0.1-beta.
- **Self-host story stays clean.** A self-hosted instance points at any libSQL — sqld, Turso, or a plain SQLite file.

### Why BetterAuth (not Clerk / NextAuth)?

- **No vendor lock-in.** Self-hostable; data stays in your DB.
- **No per-MAU pricing.** OSS, MIT.
- **Magic link is first-class** — matches the no-friction posture.
- **Plugin architecture.** Adding Google / GitHub / passkeys later is one config block.

### Why tRPC + Server Actions hybrid (not just Server Actions)?

- **Server Actions** for marketing-side forms (waitlist) — no client JS until form submits.
- **tRPC** for capture / recall / future MCP server / future RN app — typed contract that scales to multi-client.
- Best-of-both keeps the simple stuff simple and the typed-contract surface ready for v0.2+.

### Why Vercel AI SDK + Inngest plan (not Mastra / LangChain)?

- **AI SDK** is the engine — minimal abstraction, single function call (`generateObject`), Zod-schema'd.
- **Mastra is built on AI SDK.** Layering Mastra later for Acts-agent primitives is additive, not migration.
- **Inngest at v0.2** for durable Acts workflows ("draft email tomorrow at 9am") because Mastra's workflow primitives are not durable.
- LangChain is overweight for our extraction-only v0.1.1 needs.

### Why Cloudflare Workers (not Vercel)?

- **Edge globally.** Mobile p50 latency consistent worldwide.
- **Pairs with Turso** (libSQL also lives on the edge).
- **Self-host portability** preserved — no Vercel-specific image-optimization or ISR bindings.
- (Caveat: the bun-workspaces + libSQL bundling has a known issue. See [`docs/deploy.md § 9`](deploy.md#9-known-issues).)

---

## change log for this doc

- 2026-05-03 — initial version (v0.1.1 as shipped). Update when schema, flow, or framing changes.
