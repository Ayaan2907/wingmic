# wingmic readiness audit — pain points, breaking points, unfinished work

**Date:** 2026-08-07 · **Status:** planning (no product code) · **Base:** `main` @ `990c382` (PR #73 release)  
**Continues:** v0.1.x handoff (`2026-08-04-v0.1.x-completion-handoff.md`) + directives plan (`2026-08-04-directives-execution.md`)  
**Prior agent:** `bc-95310374-73e7-443f-af15-54fe5abb8826` (transcript not accessible from this environment; recon from landed PRs + handoff docs)

**Audience:** human decision + Cursor executor. Do not start implementation until the open questions in §7 are answered.

---

## 0 · Verdict (one paragraph)

The **core memory loop works**: magic-link auth → onboarding → tap-to-record / typed memo → ASR → hybrid extract → commit → chat thread → search/recall → graph → entity detail → settings persist. Directive WPs (#58–#62, chat dual-function #59) landed via #73. What remains is not "build the app from mocks" — that phase is done — but **honesty gaps** (UI that looks live but is mocked), **wire-up debt** (settings prefs unused, soft-delete client-only, desktop rails static), **prototype drift** (hold→tap, nav acts→search, settings sections), and the **roadmap wedges** still open (#2/#3/#5/#8, then v0.2 imports #10, v0.3 acts #11). Close #56 after a formal prototype sweep + tag; then plan `v0.1.3-backend-wireup` before touching epics.

---

## 1 · Landed state (do not re-build)

| Surface | Status | Notes |
|---|---|---|
| AppShell + bottom nav + desktop rail + ⌘K | **Shipped** | Nav fifth slot = **search** (not acts — deliberate #70) |
| Capture orb | **Shipped** | Tap-toggle (#55), not hold/slide (design still says hold) |
| `/chat` dual-function | **Shipped** | Intent router + inline ask answers (#59) |
| `/search` + `/recall` redirect | **Shipped** | Semantic + text fallback (#60) |
| `/graph` | **Shipped** | Real `graph.get` + force graph (#47); prod verify still #63 |
| `/settings` | **Shipped** | Persist OK; prefs unused by pipeline |
| `/onboarding` | **Shipped** | Mic step is explainer only (no `getUserMedia`) |
| `/acts` | **Visual mock only** | Seeded cards, all CTAs disabled until #11 |
| Extractor LLM-first + junk guard | **Shipped** | #58; Layer-1 NER still stubbed empty |
| Auth 30-day sliding sessions | **Shipped** | #62 |
| Client-side tab nav | **Shipped** | #61/#66 |

Open epic checklist on #56 is **stale** relative to comments: Blocker 0 (#64) and #6 are done. Remaining on #56: prototype side-by-side sweep + maintainer tag `v0.1.2-ui-complete`.

---

## 2 · Screen inventory — prototype vs product

Source of truth for visuals: `design/v2/` (`Wingmic Prototype.html`, `proto-screens-*.jsx`, `proto-desktop.jsx`, `library/lib-states.jsx`). Product: `apps/app`.

### 2.1 Shared chrome

| Proto | Product | Gap |
|---|---|---|
| Mobile nav: home · chat · mic · graph · **acts** | home · chat · mic · graph · **search** | Deliberate product choice; design.md §12 still shows acts |
| Desktop rail: Hold to capture + acts badge + pinned people | Tap language + search; pinned people partial/absent | Copy drift (OQ-6); pinned people unfinished |
| Mic: hold → lock slide-up / cancel slide-left | Tap start / tap stop | Code ahead of design; doc amend needs blessing |
| Capture = always chat-in-place (§12) | `/capture` → permanentRedirect `/chat` | Aligned |

### 2.2 Screens

| Screen | Prototype | Product reality | Pain / unfinished |
|---|---|---|---|
| **01 Onboarding** | 3 steps, "give mic access" | Real acknowledge; step 2 explainer (no permission prompt) | Optional polish: real mic prompt |
| **02 Home** | Stats, agent stripe, acts queue w/ send, commits, desktop two-pane | Real counts + recent commits; **mocked** agent stripe + 3 ActCards (send disabled); recent rows **not links**; no desktop two-pane | Fake "3 drafts pending"; home desktop lagging proto |
| **03–06 Chat** | Resting / recording / locked / response; chips; draft follow-up | Dual-function works; composer + orb; history prefetch (transcript only); soft-delete **client-only**; draft follow-up / open card **disabled**; entity rail **static mock**; `/chat` highlights **capture** tab not chat | Soft-delete lie; mock rail; disabled acts chrome; history missing entity chips; live extraction stream (δ₁) never landed |
| **07 Graph** | Filters people/orgs/events; node card; draft check-in | Real data + filters; open → entity; draft **disabled**; topic "open" has **no route** | Topic 404 risk; draft CTA chrome |
| **08 Person** | Draft check-in, edit, captures, follow-ups, related; desktop people list | Real detail; CTAs **disabled**; followups always `[]`; warmFollowup false; desktop rail **static mock** | Empty follow-ups forever until acts; mock rail |
| **09 Company** | Find warm path, draft intro | Real detail; CTAs **disabled** | Same acts chrome |
| **10 Event** | Generate recap, check-ins | Real detail; CTAs **disabled**; weak interaction→event linkage | Same |
| **11 Acts** | Pending/Sent/All filters; edit/send/skip | Seeded mock; **no filter chips**; all send disabled; not in bottom nav | Pure chrome until #11 |
| **12 Search** | Results → person; filters | Real recall; grouping chips; results **do not navigate** to entity pages | Dead-end results (high friction) |
| **13 Settings** | Canvas: capture/agent/integrations/data | Shipped v14 list (account/audio/privacy/capture/advanced/about) | OQ-4; prefs never read by capture/transcribe/linker |
| **Sign-in** | — | Magic link real | Default callback `/chat` can skip home onboarding feel |
| **Dashboard** `/dashboard` | — | Stub "coming soon" | Orphan; home is the dashboard |
| **Empty/loading/error** (lib-states) | Full artboards | Partial (some empty copy fixed #71) | Discard confirm, commit sheet, toasts, undo commit — incomplete vs library |

---

## 3 · Pain points (UX honesty / friction)

Ranked by user-facing damage if someone demos the live app today.

| # | Pain | Where | Why it hurts |
|---|---|---|---|
| P1 | **Acts looks real, does nothing** | Home stripe, `/acts`, entity CTAs, graph draft, chat "draft follow-up" | Demo trust-breaker; every primary CTA is disabled chrome |
| P2 | **Search results are dead ends** | `/search` cards | Recall works but can't open the person — breaks the H5 smoke path "click match → person" |
| P3 | **Soft-delete is a lie** | Chat discard / undo | UI removes bubble for 30s then… nothing hits DB; refresh restores |
| P4 | **Home pending acts are fake** | `pendingActs = 0` + 3 seeded cards | Stats contradict the mock queue |
| P5 | **Desktop rails still prototype data** | `ChatEntityRail`, `PersonListRail` | Looks broken once real names differ from Sarah/Acme |
| P6 | **Settings are decorative** | Retention / mic / ASR / linker override | Persist to `users` but never consumed by `/api/capture/transcribe` or `extractHybrid` |
| P7 | **Chat tab never shows active** | AppShell `activeFor` | On `/chat`, highlight is capture orb — chat slot looks dead |
| P8 | **History bubbles lack entity chips** | Chat prefetch | Only transcript; extraction tags appear only for session-new commits |
| P9 | **Nav/copy drift vs design** | Tap vs hold; search vs acts slot | Docs/prototype teach the wrong gesture and fifth tab |
| P10 | **Landing responsive still broken** | `apps/web` #37 | Marketing surface; sequence after modularize #1 |

---

## 4 · Breaking points (will fail under real use)

| # | Break | Trigger | Mitigation |
|---|---|---|---|
| B1 | Capture ASR fails | No `ASSEMBLYAI_API_KEY` | Typed composer exists; #5 still wants orb→typed when mic unsupported |
| B2 | Extract / embed / semantic recall fail | No/invalid `OPENROUTER_API_KEY` | Text text fallback shipped (#60); extract still hard-depends on LLM |
| B3 | Prod graph empty / 500 | Deploy before #57, missing `bun install`, or migration `0002` not applied | Ops checklist #63 |
| B4 | Topic node "open" | User selects topic on graph | No `/topic/[id]` — guard CTA or hide open for topics |
| B5 | Integration holes | Racey commit, no idempotency, no round-trip test | #8 first; then #45 deferred list (transaction wrap, `clientCaptureId`, dead `extract()` removal) |
| B6 | Layer-1 NER empty forever | `transcribe-entities.ts` stub | Extractor is L2+L3 only; cost/quality risk if L3 fails |
| B7 | Junk/mis-extract regressions | Eval not run after #58 in CI without key | Require `extract:eval` before release tags |
| B8 | Auth callback skips onboarding feel | Sign-in → `/chat` | Gate already on home; chat may load before acknowledge depending on middleware |

---

## 5 · Unfinished work map (by phase)

### 5.1 Close now (v0.1.2 epic #56)

1. Update #56 checklist (Blocker 0 + #6 done).
2. Formal prototype ↔ product sweep (mobile 393 + desktop ≥1120): log deviations as issues, don't fix inline.
3. Maintainer tags `v0.1.2-ui-complete`.
4. Ops: complete #63 graph-in-prod checklist.

### 5.2 v0.1.3 — backend wire-up (plan next; not yet a formal plan file)

From handoff §5 + this audit:

| Item | Scope | Issue / note |
|---|---|---|
| Wire search → entity detail | `SearchClient` links | New issue or fold into wire-up epic |
| Persist soft-delete | `capture.delete` + undo | New |
| Home recent → chat/entity links | `HomeClient` | New |
| Replace home/acts seeded mocks with real pending actions **or** honest empty state | Until #11, prefer empty/"coming in v0.3" over fake drafts | Product call |
| Desktop rails from live graph | ChatEntityRail, PersonListRail | New |
| Settings prefs → pipeline | ASR lang, linker override, mic device; retention needs OQ-1 object store | Partial until OQ-1 |
| Live extraction stream in locked chat | δ₁ leftover | New |
| Graph topic open guard | Hide or route | Small fix |
| Chat active-tab highlight | AppShell | Small fix |
| Reply-to + parent-bias (v20) | Columns migrated | Deferred feature |
| Audio retention object store (v19) | Blocked OQ-1 | — |

### 5.3 Capture quality backlog (existing issues)

| Issue | Priority | Note |
|---|---|---|
| **#8** integration round-trip test | **Do first** | Unblocks #45 stabilization |
| **#2** lazy-promotion Company/Event | p1 | `resolution.ts` |
| **#3** confidence prompt 0.5–0.85 | p1 | Chat card after commit |
| **#5** text-input fallback when mic unsupported | p2 | Partially eclipsed by composer; remaining: orb opens typed path when `recorder.supported === false` |

### 5.4 Eng-review debt (extractor)

C3 hybrid unit tests · hybrid-path eval · A2 shared `extractActionVerbs` · C2 Layer-2 regex · C1 `mergeRules` — see handoff §7. File a chore issue first (issue-first).

### 5.5 Cross-cutting / marketing

| Issue | Note |
|---|---|
| **#1** modularize landing HomeClient | Before #37 |
| **#37** landing responsive | After #1 |
| **#9** Sentry + PostHog | Blocked on dependency ack (OQ-5) |

### 5.6 Later wedges (do not start inside v0.1.x)

| Epic | What |
|---|---|
| **#10** v0.2 contact imports | LinkedIn / Google / vCard |
| **#11** v0.3 Acts agent | Makes every disabled CTA real; permission-first |

### 5.7 Chat dual-function phase 2 (explicitly deferred in #59)

Synthesized answers (Sonnet + tools), thread history persistence for coreference — plan only after phase 1 has soaked.

---

## 6 · Recommended execution order

```
A. Closeout hygiene
   1. Refresh #56 checklist + run prototype sweep → file deviation issues
   2. Tag v0.1.2-ui-complete (maintainer)
   3. #63 prod graph verify

B. Trust fixes (small, high leverage — candidates for v0.1.3 kickoff)
   4. Search result → /person|/company|/event links
   5. Soft-delete persistence (or remove undo UI until real)
   6. Graph topic open guard + chat active-tab fix
   7. Home/acts: honest empty state instead of fake drafts (until #11)

C. Hardening
   8. #8 integration test
   9. #2 → #3 → #5
   10. Write formal `v0.1.3-backend-wireup` plan (rails, settings→pipeline, δ₁ stream)

D. Parallel / gated
   11. #1 → #37 (landing)
   12. #9 when deps acked
   13. Eng-review extractor debt

E. After v0.1.3
   14. #10 imports → #11 acts
   15. Chat ask phase 2
```

One change per PR. PR target: `staging` → maintainer cuts to `main`.

---

## 7 · Open questions (need human call before coding)

| # | Question | Default if silent |
|---|---|---|
| OQ-A | Bless **tap-toggle** in `design/` (amend §12 / hold copy) or revert product to hold? | Keep tap; amend design when blessed |
| OQ-B | Keep **search** as fifth nav slot (vs proto acts)? | Keep search; update design notes |
| OQ-C | Settings: bless **v14 section list** vs rebuild canvas sections? | Bless v14; integrations wait for v0.2/v0.3 |
| OQ-D | Until Acts ships: **fake draft cards** or **honest empty** ("acts land in v0.3")? | Prefer honest empty — kills P1/P4 |
| OQ-E | Object store for audio retention (R2 / B2 / Vercel Blob)? | Blocks v19 only |
| OQ-F | Ack `#9` deps `@sentry/nextjs` + `posthog-js`? | Skip #9 until ack |
| OQ-G | Start **v0.1.3 wire-up** next, or jump to **#8** then capture backlog? | Trust fixes (B) then #8 (C) |

---

## 8 · Verification recipe (for the sweep + any later PR)

```bash
bun install --frozen-lockfile
bun run typecheck && bun run lint && bun run test
TURSO_DB_URL="file:/workspace/apps/app/local.db" bun run db:apply
bun run dev:app   # :3211 — magic link prints to console when RESEND unset
```

Side-by-side: open `design/v2/Wingmic Prototype.html` at 393px and ≥1120px vs the running app. Smoke path: memo → graph node → person → search ask → typed ask in chat. Do **not** treat disabled "coming soon · v0.3" CTAs as bugs unless the label is missing.

---

## 9 · Out of scope for the next coding session

- Building Acts (#11) or Imports (#10)
- Editing `design/**` without OQ-A/B blessing
- Editing eval fixtures
- Production `db:apply` / Railway config changes without explicit ask
- Rewriting landing before #1 modularize
