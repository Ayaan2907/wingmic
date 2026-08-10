# Decision: soft memo empty + quiet topics (keep acts under memo)

**Date:** 2026-08-10 · **Status:** approved · **Stage:** current v0.2 / trust stack  
**Issue tree:** extractor hygiene (B6-adjacent) · chat dual-function (#59) — **no new epic**

## Locked product decisions

1. **`classifyIntent` stays `memo | ask` only.** Acts are not a third router label. Draft email / follow-up / meeting continue to emerge from `extracted.actions[]` on the memo commit path (plus manual CTAs).
2. **Soft empty (choice 2).** When a committed memo has no persons, companies, events, or actions, show a soft agent line: *“noted — nothing solid to tag yet.”* Do not invent purple keyword tags to fill the space.
3. **Quiet topics.** Topics are noun subjects worth remembering — never verbs (`discussed`), never echoes of extracted person/company/event names (`lucas`, `francisco` fragment of a person/place already captured). Deterministic sanitize after merge; no new NER package this slice.
4. **Unstructured speech is fine.** Wispr-style dumps and loose “we discussed…” memos both route as memo; sparse graph is a valid outcome.

## Non-goals (this slice)

- Oxlo-style L1 LLM NER rebuild  
- Killing Layer-2 heuristics wholesale  
- Third intent `act`  
- Dual-agent phase 2 (synthesized answers)

## Files

| File | Change |
|---|---|
| `packages/extractor/src/stopwords.ts` | speech verbs that are not topics |
| `packages/extractor/src/hybrid.ts` | `sanitizeExtraction` filters topics |
| `apps/app/app/chat/_components/ChatThread.tsx` | soft agent reply on empty extraction |
| tests | sanitize + ChatClient empty soft copy |

## Acceptance

- Memo “we discussed that and followed up” with no named people → soft agent line, no purple junk.  
- Memo “met Lucas at Trillers…” → person + company; topics must not include `discussed` or `lucas`.  
- Spoken “email Lucas tomorrow” still can produce an act via existing action extraction (unchanged router).
