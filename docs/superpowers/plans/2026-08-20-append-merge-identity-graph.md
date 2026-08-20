# Append-merge identity + graph — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop duplicate people on recapture, let users merge existing duplicates, show LinkedIn-shaped public cards, and calm the graph canvas.

**Architecture:** Four stacked PRs from [`2026-08-20-append-merge-identity-graph-design.md`](../specs/2026-08-20-append-merge-identity-graph-design.md). WP1 fixes data at `commit()` via strict local match before fuzzy score. WP2 adds `entity.merge` + person UI. WP3 replaces static links with a card. WP4 adjusts canvas paint only.

**Tech Stack:** `@wingmic/extractor` (`resolution.ts`, `slug.ts`, `linkedin.ts`), `@wingmic/db`, tRPC `entity` router, `EntityDetailScaffold`, `GraphClient` + `react-force-graph-2d`, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-append-merge-identity-graph-design.md` (approved 2026-08-20)

---

## WP1 — unique same-owner reuse (`feat(extractor)`)

**Branch:** `cursor/unique-person-recapture-d48b` → `staging`  
**Closes:** partial [#122](https://github.com/Ayaan2907/wingmic/issues/122)

### Task 1: `normalizePersonName`

**Files:**
- Modify: `packages/extractor/src/slug.ts`
- Modify: `packages/extractor/src/__tests__/slug.test.ts`

- [ ] Add `normalizePersonName(name)` — lowercase tokens, strip punctuation, join with space (exact match only; not `namesOverlap`).
- [ ] Add `personNameEquals(a, b)` and `entityMatchesPersonName(candName, entity)`.
- [ ] Tests: `Sarah Chen` = `sarah chen`; `Tomo` ≠ `Tomo Matsuo`.

### Task 2: `matchLocalPerson`

**Files:**
- Modify: `packages/extractor/src/resolution.ts`

- [ ] Preload `entity_company` edges per entity (for `companyBoost` + `uniqueNameAtCompany`).
- [ ] Preload `linkedin` facts → canonical via `canonicalizeLinkedin` from `./linkedin`.
- [ ] Implement strict order: uniqueEmail → uniqueLinkedin → collidingEmailOrLinkedin → uniqueNameAtCompany → uniqueName → fuzzy ≥0.85 → create.
- [ ] On any link: refresh embedding; skip duplicate email/linkedin facts; skip existing `entity_topic` edges; append alias on email/LinkedIn path when display name differs.
- [ ] Wire `companyBoost = 1` when entity already `works_at` candidate company.

### Task 3: Tests + docs

**Files:**
- Modify: `packages/extractor/src/__tests__/resolution.test.ts`
- Modify: `docs/architecture.md` §6

- [ ] Test: Ada Lovelace twice → one entity, two interactions, `persons[1].created === false`.
- [ ] Test: two `Tomo Matsuo` + third same name → creates third.
- [ ] Test: two Tomos, email on one → reuses that one.
- [ ] Test: `Tomo Matsuo` living, candidate `Tomo` → new entity.
- [ ] Run: `bun --filter @wingmic/extractor test`

---

## WP2 — merge UI + trail topics (`feat(app)`)

**Branch:** `cursor/person-merge-trail-d48b` → `staging` (stack on #143 if not merged)  
**Depends:** WP1

### Task 4: Schema migration

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: new Drizzle migration (`entity_merge.reversed_at`, `entity_merge.moves`)

### Task 5: `entity.merge` + `entity.undoMerge`

**Files:**
- Modify: `apps/app/lib/trpc/routers/entity.ts`
- Modify: `apps/app/lib/trpc/routers/entity.test.ts`

- [ ] Transaction: re-point facts/edges/acts; write `entity_merge` + `moves` JSON; soft-delete source.
- [ ] Undo within 30s reverses moved ids only.

### Task 6: Person UI

**Files:**
- Modify: `apps/app/app/_components/entity/EntityDetailScaffold.tsx`
- Modify: `apps/app/app/person/[id]/PersonDetailClient.tsx`
- Modify: `entity.ts` capture type + `CaptureCard` topic chips

- [ ] `merge into this` on possible matches; confirm sheet; undo chip.
- [ ] Capture trail shows per-memo topic chips.

---

## WP3 — LinkedIn public card (`feat(app)`)

**Branch:** `cursor/person-linkedin-card-d48b` → `staging` (stack on #143)  
**Depends:** WP2 optional

- [ ] Replace `PublicProfileCard` link list with LinkedIn-shaped card + `press mention →` line.
- [ ] Initials only; no Tavily images; no LinkedIn fetch.

---

## WP4 — graph paint (`feat(app)`)

**Branch:** `cursor/graph-neighborhood-dim-d48b` → `staging`  
**Independent of WP2/WP3**

- [ ] Caption only on hover/select/zoom ≥ 1.35.
- [ ] Neighborhood dim for selected node + 1-hop.
- [ ] d3 charge / link distance / collision tuning.
- [ ] Unit tests for caption gate + neighborhood set.

---

## Verification (each WP)

```bash
bun run typecheck && bun run lint && bun run test && bun run build:app
```
