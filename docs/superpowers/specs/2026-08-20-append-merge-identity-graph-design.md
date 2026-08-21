# Append-merge identity, person cards, graph paint

**Date:** 2026-08-20 · **Status:** approved · **Base:** `staging`  
**Parent tickets:** [#122](https://github.com/Ayaan2907/wingmic/issues/122) (local match before fuzzy score), [#3](https://github.com/Ayaan2907/wingmic/issues/3) (mid-band prompt — **not this spec**), [#130](https://github.com/Ayaan2907/wingmic/issues/130) (verified wingmic probe — **read, do not implement here**)  
**Related:** fingerprint spec [`2026-08-18-identity-fingerprint-search-design.md`](./2026-08-18-identity-fingerprint-search-design.md); hosted-capture merge dialog in [`../plans/2026-05-23-v0.1.1-hosted-capture.md`](../plans/2026-05-23-v0.1.1-hosted-capture.md) (~entity page / 30s undo); PR [#143](https://github.com/Ayaan2907/wingmic/pull/143) (person `on the web` + `also in your graph`, capture-level topics)

This spec is the product lock from 2026-08-20. It does **not** authorize implementation until the founder accepts this file. Four stacked PRs after that — never one mega-diff.

---

## 0. Why this exists

Recording the same memo two or three times currently mints two or three `entity` rows for the same spoken person (three “Tomo Matsuo” discs on `/graph`). The graph looks sticky because the data is wrong, then paint makes it worse (full captions on every node, highlight = selected id only, default d3 charge).

`resolvePerson` in `packages/extractor/src/resolution.ts` only **links** at **score ≥ 0.85**. Score is:

```
0.5 * name + 0.2 * embedding + 0.15 * companyBoost + 0.3 * email + 0.05 import
```

`companyBoost` is hardcoded `0`. Exact same display name is **0.5**. A slightly different memo changes the embedding, so the score stays under 0.85 and `commit()` **inserts**. `docs/architecture.md` §6 still quotes an older 0.55/0.25 formula; the code above is the live one. Update architecture in the first implementation PR, not in this docs PR.

Fingerprint rule **`name_lower` never auto-merges across users** stays. This spec is **same owner, private graph only**.

---

## 1. Locked product

### 1.1 Recapture = append-merge (not a new person)

New audio is always a new `interaction`. It is **not** a new person when this owner already has a unique living match.

| Situation | Commit does |
|---|---|
| This owner has **exactly one** living person (`deletedAt` null) whose **normalized name** equals the candidate (or an alias) | **Reuse that id.** Do not apply the 0.85 bar to split them. |
| Candidate has `companyHint`, and among same-name people **exactly one** already `works_at` that company | Reuse that id. |
| Candidate has `companyHint`, same-name set size is 1, that person has **no** company yet | Reuse; fill the `entity_company` edge (existing fill-blank path). |
| Candidate has a unique `email` (trim + lowercase) or unique normalized LinkedIn among this owner's living people | Reuse that id (**#122**, before fuzzy score). |
| **Two or more** living people already share that name (today’s Tomo mess), and no unique email/LinkedIn/company tie-break | **Do not guess.** Fall through to existing ≥ 0.85, else create. Cleanup is the explicit merge in §1.2. |
| Email/LinkedIn hits **two or more** living people | Do not create a third. Reuse the **highest** `resolvePerson` score among **those hits only**, even if `< 0.85`. |
| No unique local match and best fuzzy score `< 0.85` | Create, same as today. |

**Normalized name** = `normalizePersonName` in `packages/extractor/src/slug.ts` (same token rules as `nameTokens` in `apps/app/lib/entity/namesOverlap.ts`: lowercase, punctuation stripped, join with a single space). **Exact** token-join equality only. `namesOverlap` (“Tomo” ↔ “Tomo Matsuo”, “Sagar” ↔ “Sagar Patel”) is **not** an auto-link. Those pairs stay in `also in your graph` for the human.

**Append** (matched or unique-reused id — never wipe the first meeting):

- Always insert a new `interaction` (already true).
- Topics: existing skip-if-`entity_topic` edge exists; new topics get `sourceInteractionId` = this interaction (PR #143).
- Company/role: insert `entity_company` if missing; fill `role` only when the existing row’s role is blank.
- Facts: skip insert when the same `key` + comparable `value` already exists on that entity (`email` compared trim+lowercase; `linkedin` compared after URL normalize). Always insert a new `note` row when the candidate has notes (per-memo). Do not overwrite `entity.name`. If the matched name differs (email/LinkedIn path), append the candidate name to `aliases` when it is not already there.
- Refresh embedding on the kept entity (already true on the ≥ 0.85 path). Do the same on unique-name reuse.

**Match-then-append at commit.** Do not insert a duplicate and merge after every recapture.

### 1.2 Explicit keep-this-one (existing duplicates)

When two or more same-name people already exist, the person page section `also in your graph` (PR #143: `open →` only) becomes an **append-merge**:

- The **open person is the keeper**.
- Each other card is a **source**. CTA copy: `merge into this` (not `open →` as the primary action). A quieter `open` control remains so the user can inspect before merging.
- One source per confirm. **No bulk-merge of the whole list** (two Tomos might be different people).
- Confirm sheet (hosted-capture copy, adapted): `merge ${source.name} into *${keeper.name}*? captures and facts move over. this can't be undone after 30s.`
- Server: re-point rows onto the keeper, write `entity_merge`, set `source.deletedAt`. Graph then shows one disc because `graph.get` already skips `deletedAt`.
- 30s undo tombstone, same product rule as hosted-capture §17.2.

There is **no** `interactionEntities` table (hosted-capture assumed one). Linkage is `entity_fact` / `entity_topic` `sourceInteractionId`, plus `entity_company` / `entity_event` / `act.targetEntityId`. Re-point those.

### 1.3 Person page trail + public cards

**from your captures** is the chronological trail: time, transcript excerpt, **topic chips from that memo** (`entity_topic.sourceInteractionId` = that interaction). Do **not** invent `eventName` on the capture card (entity router already refuses to fake it). A new recapture is a new beat on the **same** person after §1.1.

**on the internet** is a LinkedIn-shaped **card**, not a list of text links:

- Render only when a **stored** `entity_fact` `linkedin` URL exists (`linkedinProfileHref` already used by `publicProfileFromFacts`).
- Layout: initials disc (`PersonAvatar`) · name · role · company · CTA `show their linkedin` (lowercase; opens the stored URL, `target=_blank`, `rel=noopener noreferrer`).
- Thumbnail: initials until a **trusted stored** `photo_url` fact exists on an allowlisted host (`media.licdn.com`, `media-exp.licdn.com`, `*.licdn.com`). **No LinkedIn HTML GET. No Tavily `include_images` as a face.** Wrong-person risk is unacceptable.
- GlobeNewswire-style `url` / `source_url` are **not** a profile. If present and not the LinkedIn URL, a quieter line `press mention →` (host label) may sit **under** the card. Never as the identity block.

**on wingmic** only if they are a **verified** platform user in this network (`identity_claim.verified = true` on email or LinkedIn that matches this person's stored facts). Do not fake an account. **Until #130 ships, omit this card.** Onboarding LinkedIn is `verified=false` and is not a key.

### 1.4 Graph paint (after merge, remaining unreadability)

Duplicates are mostly a data bug. After §1.1–1.2 the canvas calms. Remaining paint, Obsidian / Graphify-inspired:

- Initials stay **inside** the disc (already `graphNodeInitials`).
- **One caption, not always.** Draw `graphNodeCaption` only when the node is selected, hovered, or `globalScale >= 1.35`. Otherwise initials only. Hover card already shows the full name (`GraphHoverCard`).
- **Neighborhood dim:** selected node + 1-hop via current `data.links`. Those stay full opacity; every other node/link paints at ~0.22 / ~0.15 alpha. No selection → no dim.
- **Spacing:** customize d3 forces via `fgRef.current.d3Force` (today GraphClient never does). Charge ≈ `-180`, link distance ≈ `70`, collision radius `NODE_PAINT_RADIUS + 8`. Tune only these three; do not replace `react-force-graph-2d`.
- Search keyboard nav and hover-card clamp stay as they are. Selecting a search hit uses the same neighborhood dim.

Do **not** merge company/event/topic nodes in this spec. Duplicate “AdvanceIQ-ish” orgs are a canonical-slug problem (#2), not graph paint.

---

## 2. Non-goals

- Invent named **events** from “I met with X” (already skipped in the extractor).
- Persist act **channel** (needs a migration not requested here).
- Mid-band 0.5–0.85 chooser as full **#3** (prompt on every recapture when a unique Tomo already exists is unnecessary once §1.1 ships).
- Cross-user auto-link; writes to `entity_resolution` or `connection_request`.
- Scraping LinkedIn HTML; using Tavily search images as headshots.
- Auto-merge on `namesOverlap` or fingerprint `name_lower` across users.
- Bulk-merge of every possible match in one click.
- Company/event canonical dedup.
- Replacing `react-force-graph-2d` with Obsidian’s engine.

---

## 3. Resolution algorithm (commit)

Same owner. Living people only. Order is **strict**.

```
1. uniqueEmail     — cand.email trim+lowercase, exactly one living person with that fact
2. uniqueLinkedin  — linkedinProfileHref-equivalent normalize, exactly one living person
3. collidingEmailOrLinkedin — 2+ hits → best resolvePerson score among hits only (never create)
4. uniqueNameAtCompany — exact normalizePersonName (or alias) AND exactly one of those
                         has entity_company to cand.companyHint's upserted id
5. uniqueName      — exact normalizePersonName (or alias), set size === 1
                     (companyHint optional; fill blank company as today)
6. fuzzy           — existing resolvePerson; link iff score >= 0.85
                     companyBoost = 1 when the entity already has a works_at
                     edge to the candidate's company (stop hardcoding 0)
7. create
```

`resolvePerson` stays private to `resolution.ts`. Lift unique-name / unique-email / unique-linkedin into small exported helpers so tests do not go through the LLM.

---

## 4. Merge mutation (tables that actually exist)

`entity.merge` — `protectedProcedure`.

**Input:** `{ sourceId, targetId }` (both person entity ids).

**Guards:**

- `ctx.user.id` owns both; both `kind = person`; both `deletedAt` IS NULL; `sourceId !== targetId`.
- Else `TRPCError` FORBIDDEN or NOT_FOUND — never leak another user's ids.

**Writes (one transaction):**

1. For each source `entity_company` / `entity_event` / `entity_topic` / `entity_fact` / `act`:
   - If the keeper already has an equivalent company/event/topic pair or fact `key` + comparable `value`: copy blank-fills onto the keeper (e.g. source `role` when target role is null). **Leave the source row on the source** (it disappears from the graph with `deletedAt`).
   - Else set `entityId` / `targetEntityId` to the keeper and record the row id in `moves`.
2. Append `source.name` to `target.aliases` when missing (`aliasAdded` in `moves`).
3. Insert `entity_merge` (`sourceEntityId`, `targetEntityId`, `mergedByUserId`, `moves`).
4. Set `source.deletedAt = now`.

Never leave two identical live edges on the keeper. Duplicate-equivalent rows stay on the tombstoned source so 30s undo can revive them without a re-insert.

**Undo (30s):** hosted-capture required it. `entity_merge` today has no payload column. **New append-only migration** (not an edit of an old file):

- `entity_merge.reversed_at` nullable timestamp
- `entity_merge.moves` text JSON: `{ facts, companies, events, topics, acts, aliasAdded }` — ids that actually moved, plus the alias string if we added one

`entity.undoMerge({ mergeId })` within 30s of `mergedAt`, same owner: re-point `moves` row ids back to `sourceId`, remove `aliasAdded` if we added it, clear `source.deletedAt`, set `reversedAt`. After 30s: `PRECONDITION_FAILED`, leave the merge. No hard-delete sweep. Duplicate-equivalent rows that never moved are already on the source.

Tombstone chip on the person page: `*${source.name}* merged · ↶ undo` for 30s (hosted-capture pattern).

---

## 5. File map (implementation PRs, not this docs PR)

| Area | Files |
|---|---|
| Unique match + append | `packages/extractor/src/resolution.ts`, `packages/extractor/src/__tests__/resolution.test.ts`, `packages/extractor/src/slug.ts` (`nameSimilarity` already lives here) |
| Name / LinkedIn normalize | Add `normalizePersonName` next to `nameSimilarity` in `packages/extractor/src/slug.ts`, same token rules as `nameTokens` in `apps/app/lib/entity/namesOverlap.ts`. Add a LinkedIn normalize helper beside it that matches `linkedinProfileHref` (`apps/app/lib/acts/linkedinHref.ts`): `/in/` profiles only, strip `www`, query, hash, trailing slash. **Do not import `apps/app` from `packages/extractor`.** Do not add a package. |
| Merge API | `apps/app/lib/trpc/routers/entity.ts` + `entity.test.ts` |
| Schema | `packages/db/src/schema.ts` + **new** Drizzle migration for `reversed_at` / `moves` |
| Person UI | `apps/app/app/_components/entity/EntityDetailScaffold.tsx`, `PersonDetailClient.tsx`, person detail tests |
| Trail topics | `entity.ts` `Capture` type + `EntityCapture` + `CaptureCard` |
| LinkedIn card | `PublicProfileCard` in `EntityDetailScaffold.tsx` |
| Graph paint | `apps/app/app/graph/graph-style.ts`, `graph-node-label.ts`, `GraphClient.tsx`, `graph-node-label` tests |
| Architecture | `docs/architecture.md` §6 formula + unique-name rule (with WP1) |

`entity_merge` is already in schema and unused. `graph.get` already filters `deletedAt`. Do not add `interactionEntities`.

---

## 6. PR stack (one change per PR)

| # | Branch intent | Ships | Depends |
|---|---|---|---|
| **WP0** | this file | spec only | — |
| **WP1** | `feat(extractor): reuse unique same-owner person on recapture` | §1.1 + §3 + architecture §6 + #122 email/LinkedIn + live `companyBoost` + skip duplicate facts | `staging` |
| **WP2** | `feat(app): keep-this-one append-merge and capture trail topics` | §1.2 + trail chips + 30s undo | WP1; person `possibleMatches` from PR #143 — **stack on #143 or wait for it to merge** |
| **WP3** | `feat(app): linkedin-shaped person public card` | §1.3 internet card; omit wingmic card | PR #143 `PublicProfileCard`; #130 not required |
| **WP4** | `feat(app): graph initials-only labels and neighborhood dim` | §1.4 | `staging` (independent of merge; calmer after WP1–2) |

Do not combine WP1 with UI. Do not combine graph paint with merge.

---

## 7. Acceptance

**Recapture (WP1):** commit Ada Lovelace twice (same owner, no email, embeddings that would score `< 0.85`). Result: **one** `entity`, **two** `interaction`s, `persons[1].created === false`, second notes/topics appended, first role/company intact. Graph: one person node.

**Ambiguous names (WP1):** two living “Tomo Matsuo” already in the DB, third commit with that name and no email → **creates** a third (do not guess). Unique email on one of them → reuses that one.

**Partial names (WP1):** living “Tomo Matsuo”, candidate “Tomo” → **does not** auto-reuse (not exact normalized name). `possibleMatches` / `namesOverlap` still surfaces them in WP2.

**Explicit merge (WP2):** three Tomos; on keeper, `merge into this` for one source → source `deletedAt` set, facts/edges/acts on keeper, `entity_merge` row, graph one disc for those two. Undo within 30s restores the source. Undo at 31s fails.

**Trail (WP2):** two captures on the keeper show two beats, newest first, each with that memo’s topic chips.

**Public card (WP3):** stored LinkedIn → card with `show their linkedin`. Only `source_url` globenewswire → no LinkedIn card, only `press mention →`. No network fetch of LinkedIn HTML in tests or runtime. No `include_images`.

**Wingmic card (WP3):** absent while #130 is open.

**Graph (WP4):** at default zoom, discs show initials only (no overlapping “Tomo Ma” layers). Hover or select shows caption + existing hover card. Selected neighborhood stays bright; the rest dims. Nodes do not sit on top of each other under the new forces (visual check + unit tests for caption gating / neighborhood set).

---

## 8. Alignment notes

- **Fingerprint spec:** `name_lower` still never auto-merges **across users**. Same-owner **exact unique name** is a local uniqueness rule, not a fingerprint write, not import name-only matching (`matchContacts` name-only stays ambiguous).
- **#122:** WP1 implements email/LinkedIn-before-fuzzy and a real `companyBoost` without waiting for PersonaDraft / `packages/enrich`. Unique-name reuse is the 2026-08-20 addition #122 explicitly left to #3; this spec **takes unique-name off #3** and leaves the mid-band prompt on #3.
- **#3:** still the 0.5–0.85 chooser when the name is **not** unique. Do not build it here.
- **#130:** verified `identity_claim` probe. Person page “on wingmic” waits for it.
- **PR #143:** already added static `on the web` links and `open →` possible matches. WP2/WP3 replace those affordances; they should not land on `staging` until #143 is in or they stack on that branch.
- **Hosted-capture merge dialog:** search-to-pick-a-target is **out of scope**. This spec only merges a listed same-name duplicate into the open person. A general “merge into…” search sheet can reuse `entity.merge` later.

---

## 9. Open questions (defaults locked; change only if the founder objects)

| ID | Default | Alternative |
|---|---|---|
| OQ-1 | Exact normalized name, not `namesOverlap`, for auto-reuse | Treat “Tomo” as Tomo Matsuo when unique |
| OQ-2 | Per-source `merge into this` | One `keep this one` that merges **all** listed matches |
| OQ-3 | CTA `show their linkedin` | Founder example “show his LinkedIn profile” (gendered) |
| OQ-4 | Caption zoom gate `globalScale >= 1.35` | Captions only on hover/select, never at zoom |
| OQ-5 | 30s undo with `moves` JSON migration | Merge without undo (schema stays as-is) |

If this file is accepted with no comment on OQ-*, implement the **Default** column.
