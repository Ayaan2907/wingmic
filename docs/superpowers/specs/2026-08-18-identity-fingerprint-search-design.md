# Identity fingerprint + web search adapters

**Date:** 2026-08-18 · **Status:** draft for issue tree · **Base:** `staging`  
**Parent:** [#100](https://github.com/Ayaan2907/wingmic/issues/100) (leftover of [#10](https://github.com/Ayaan2907/wingmic/issues/10))  
**This issue is the roadmap ticket** that later authorizes `packages/enrich` (or `apps/app/lib/enrich` first).

---

## Goal

Take the signals we already extract — a LinkedIn URL, a spoken name plus company, an event or company name — and look them up on the *public* web without ever driving a LinkedIn session. Normalize every vendor response into one `PersonaDraft` (a field-union of `ImportContactDraft`, `PersonCandidate`, and the `entity_fact` keys we already write). Hash a *ranked identity key* so the same Ada at Acme fingerprints the same way from user A's memo and user B's CSV. Use that fingerprint to (a) match *this* user's private people, (b) notice an opt-in `identity_claim` on a wingmic account, never auto-link, and (c) converge canonical company/event rows. People stay `ownerUserId`-scoped until mutual consent.

## Non-goals

- **No LinkedIn HTML scrape, no session driver, no Unipile-class vendor.** Sign In with LinkedIn grants `openid` / `profile` / `email` only. The connections API is gone (2015). CSV / vCard / device import remains the legal contact path (#102).
- **No attendee rosters** from Luma, Partiful, calendars, or search snippets. Shared `event` / `company` rows are public facts about the world, not a guest list (#100, #104).
- **No auto-linking people across users.** `identity_claim` is read as an opt-in hint. Do not write `entity_resolution` or `connection_request` in this epic.
- **No parallel people store.** No new `person_fingerprint` table, no vendor JSON columns. Adapters map *into* `entity` + `entity_fact` + `company` / `event` / `topic`.
- **No first-class package in WP1.** This spec *is* the ticket. Start under `apps/app/lib/enrich`. Cut `@wingmic/enrich` only when capture and import both consume the same module (see open questions).

---

## Current vs target data flow

### Current

```
voice  → transcribe → PersonCandidate → resolution.ts
                      (knownContacts + email + import boost,
                       owner-scoped only)
                      → entity (kind=person, ownerUserId)
                      → entity_fact (email, linkedin, notes)
                      → upsertCompany / upsertEvent (slug, lazy promotion)

CSV / vCard / device → ImportContactDraft
                      → matchContacts (email → linkedin → name;
                         name-only = ambiguous)
                      → same entity + entity_fact writes
                      → identifier maps preserved
                        (do not steal another entity's email/linkedin)

identity_claim / entity_resolution / connection_request
                      → schema exists, never written
```

Capture already refuses to resolve people across users. Imports already refuse to copy an email or LinkedIn URL that another *owned* entity holds (`filterSafeIdentifierFacts`). Canonical company/event already converge on slug (and company domain).

### Target

```
voice PersonCandidate ─┐
import draft          ─┼→ PersonaDraft
web adapter hit       ─┘       │
                               ▼
                    fingerprint(PersonaDraft)
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
  1. owner-scoped        2. identity_claim     3. company / event
     matchContacts          verified only          slug / domain
     (reuse indexes)        read, no write         upsertCompany /
                                                   upsertEvent
                               │
                               ▼
                    4. web adapter IFF
                       local miss or low confidence
                       (never a LinkedIn session)
                               │
                               ▼
                    write via existing tables
                    person → this owner's entity + facts
                    company/event → canonical rows
                    evidence URL → entity_fact key `source_url`
```

Web search is a *last* step, not the identity system. Local miss / low confidence only. Query text is built from *this* user's signals — never from another user's private facts.

---

## PersonaDraft — one Zod DTO

Field-union of `ImportContactDraft` + `PersonCandidate` + today's `entity_fact` keys (`email`, `linkedin`, `notes`) + optional web evidence. Unify the two LinkedIn field names and the two company field names at parse time so adapters never leak `linkedinUrl` vs `linkedin` downstream.

```ts
import { z } from 'zod';
import { importContactDraftSchema } from '../imports/types';

/** Public page the adapter cited. Never store vendor JSON or HTML. */
export const webEvidenceSchema = z.object({
  sourceUrl: z.string().url(),
  retrievedAt: z.coerce.date(),
  adapterKind: z.enum(['brave', 'tavily', 'google_cse', 'local']),
  snippet: z.string().trim().max(500).nullable().optional(),
});

export const fingerprintKindSchema = z.enum([
  'linkedin_url_normalized',
  'email_lower',
  'name_company',
  'name_lower',
]);

export const fingerprintSchema = z.object({
  kind: fingerprintKindSchema,
  /** Ranked identity key, the only string we hash. */
  key: z.string().min(1),
  /** sha256 hex of `key` (64 chars). */
  hash: z.string().length(64),
  /** `fp:v1:${kind}:${hash}` */
  id: z.string().regex(/^fp:v1:(linkedin_url_normalized|email_lower|name_company|name_lower):[a-f0-9]{64}$/),
  /** false only for `name_lower` — never auto-merge on weak. */
  strong: z.boolean(),
});

/**
 * Union of import + extractor + fact keys + evidence.
 * `linkedin` is the canonical profile field (PersonCandidate name).
 * `linkedinUrl` is accepted on input and copied onto `linkedin`.
 * `company` is the canonical org name; `companyHint` is accepted and copied.
 */
export const personaDraftSchema = importContactDraftSchema.extend({
  aliases: z.array(z.string().trim().min(1).max(200)).default([]),
  linkedin: z.string().trim().nullable().optional(),
  companyHint: z.string().trim().max(200).nullable().optional(),
  companyDomain: z.string().trim().max(200).nullable().optional(),
  topics: z.array(z.string().trim().min(1).max(80)).default([]),
  event: z.string().trim().max(200).nullable().optional(),
  eventUrl: z.string().url().nullable().optional(),
  /** Person homepage / press URL — entity_fact key `url`. */
  url: z.string().url().nullable().optional(),
  evidence: webEvidenceSchema.nullable().optional(),
  fingerprint: fingerprintSchema.optional(),
});

export type PersonaDraft = z.infer<typeof personaDraftSchema>;
export type Fingerprint = z.infer<typeof fingerprintSchema>;
export type WebEvidence = z.infer<typeof webEvidenceSchema>;

/** After parse: linkedinUrl/linkedin and company/companyHint collapsed. */
export function canonicalizePersona(draft: PersonaDraft): PersonaDraft {
  const linkedin = draft.linkedin ?? draft.linkedinUrl ?? null;
  const company = draft.company ?? draft.companyHint ?? null;
  return {
    ...draft,
    linkedin,
    linkedinUrl: linkedin,
    company,
    companyHint: company,
  };
}
```

Map onto existing shapes with no new columns:

| PersonaDraft field | ImportContactDraft | PersonCandidate | entity_fact key | canonical |
|---|---|---|---|---|
| `name` | `name` | `name` | — | `entity.name` |
| `aliases` | — | `aliases` | — | `entity.aliases` |
| `email` | `email` | `email` | `email` | — |
| `linkedin` / `linkedinUrl` | `linkedinUrl` | `linkedin` | `linkedin` | — |
| `company` / `companyHint` | `company` | `companyHint` | — | `company.name` + slug |
| `companyDomain` | — | — | — | `company.domain` |
| `role` | `role` | `role` | — | `entity_company.role` |
| `phone` | `phone` | — | `phone` (new key, same table) | — |
| `notes` | `notes` | `notes` | `notes` | — |
| `topics` | — | `topics` | — | `topic` + `entity_topic` |
| `event` | — | — | — | `event.name` + slug |
| `eventUrl` | — | — | — | `event.url` |
| `url` | — | — | `url` | — |
| `evidence.sourceUrl` | — | — | `source_url` | — |
| `fingerprint.id` | — | — | `fingerprint` | — |

`user.name` stays a single nullable string (BetterAuth). Do not invent first/last columns. Fake example only: Ada Lovelace, `ada@example.com`, `https://www.linkedin.com/in/ada-lovelace`.

---

## Fingerprint recipe

Hash the **strongest available identity key**, not the whole `PersonaDraft`. Adding notes, a role, or a new evidence URL must not change who this is.

### Ranked key (first hit wins)

1. **`linkedin_url_normalized`** (strong)  
   Reuse `isLinkedInHost`. Parse URL, lowercase host+path, strip `www.`, query, hash, trailing slash. Keep `/in/{handle}` (or `/pub/…` if that is all we have).  
   Example: `https://www.linkedin.com/in/Ada-Lovelace/?trk=foo`  
   → key `linkedin:linkedin.com/in/ada-lovelace`
2. **`email_lower`** (strong)  
   Trim + lowercase.  
   → key `email:ada@example.com`
3. **`name_company`** (strong enough to *converge companies*, not to merge people across users)  
   `name` lowercased, whitespace collapsed; company side is `companyDomain` with `www.` stripped, else `slugify(company)` from `@wingmic/extractor` so it matches `company.slug`.  
   → key `name_company:ada lovelace|acme.dev`
4. **`name_lower`** (weak)  
   → key `name:ada lovelace`  
   **Never auto-merge.** Same rule as `matchContacts`: name-only is `ambiguous`. Compute the hash for logs and for canonical company/event *hints*; do not upsert onto an existing person from this key alone.

### Hash

```
hash = sha256(utf8(key)).hex()          // 64 lowercase hex chars
id   = `fp:v1:${kind}:${hash}`
strong = kind !== 'name_lower'
```

Version prefix `v1` so a later normalizer can coexist. Do not bump `v1` because a snippet changed — only because the *key recipe* changed.

### What stability buys

User A memos "met Ada Lovelace who works on rust at Acme". User B drops a CSV row `Ada Lovelace, ada@example.com, Acme`. After adapters fill Ada's LinkedIn URL, both produce `fp:v1:linkedin_url_normalized:<same hash>`. Each user still gets **their own** `entity` row. The `company` slug `acme` (and domain `acme.dev` if found) is the same row; `observedCount` increments; `promotedAt` flips on the second observer. People do not collapse until `identity_claim` + mutual consent (out of this epic).

Store `fingerprint.id` as `entity_fact.key = 'fingerprint'` on the **owner's** person. There is no global fingerprint index of people.

---

## Multi-tier search pipeline

Run in order. Stop at the first strong local hit. Web is tier 4.

| Tier | Where | What | On hit |
|---|---|---|---|
| 1 | this owner's `entity` + `entity_fact` | Reuse `matchContacts` / `resolveMatch`. Map `PersonaDraft` → `ImportContactDraft` (`linkedin` → `linkedinUrl`). Email → LinkedIn → name. Name-only = ambiguous. Honor `filterSafeIdentifierFacts`. | write facts onto that entity; skip web |
| 2 | `identity_claim` | Lookup `kind+value` for the fingerprint's LinkedIn or email. **`verified = true` only.** Do not require `public`. | surface "this person may be on wingmic" to the *querying* user; **do not** write `entity_resolution` |
| 3 | `company` / `event` | Domain, then slug (`slugify`). Lazy promotion already in `resolution.ts` `upsertCompany` / `upsertEvent`. | increment `observedCount`; set `domain` / `url` if empty; skip web for that org/event |
| 4 | `SearchAdapter` | Only if person match is `none` or `ambiguous` *and* we have a LinkedIn URL or `name+company`, or if company/event has no slug/domain hit and the user actually named one | map hits to `PersonaDraft[]`; never persist vendor JSON |

Tier 2 is a *platform* check, not a graph merge. Two wingmic users who both know Ada still have two person rows.

Do not build a search query from user B's private notes to help user A, or the reverse.

---

## Adapter contract

```ts
export type AdapterKind = 'brave' | 'tavily' | 'google_cse';

export type SearchIntent = 'person' | 'company' | 'event' | 'general';

export type SearchQuery = {
  intent: SearchIntent;
  /** Free-text sent to the vendor. Built from this user's signals only. */
  q: string;
  hints?: {
    linkedinUrl?: string;
    name?: string;
    company?: string;
    domain?: string;
    event?: string;
  };
};

export interface SearchAdapter {
  kind: AdapterKind;
  search(query: SearchQuery): Promise<PersonaDraft[]>;
}
```

Implementations (`BraveSearchAdapter`, `TavilySearchAdapter`, `GoogleCseAdapter`) live behind this interface. Each maps *into* `PersonaDraft` and drops the rest. Query construction:

- Person + LinkedIn URL: `q = '<normalized linkedin url>'` (Tavily). We still do not fetch LinkedIn HTML ourselves; we accept a search *index* hit whose `sourceUrl` is that profile.
- Person + name/company: `q = '"Ada Lovelace" Acme'` (Tavily).
- Company: `q = 'Acme official site'` (Tavily or Brave).
- Event: `q = 'ETH Denver 2026'` (Brave).
- General: Brave.

If the vendor returns a LinkedIn URL, keep the URL string and run it through `normalizeLinkedIn`. Do not GET that URL from our servers.

Env keys stay in `apps/app/lib/config/env.ts` (optional, empty stripped). Missing keys → skip tier 4, local pipeline still works. Do not add `process.env` outside `packages/env` / the existing env module.

Starting pair: **Brave** (general / events / news) + **Tavily** (person / company snippets). Google Programmable Search is a later fallback, same interface.

---

## Comparison

| Approach | Person quality | Company / event quality | ToS / ban risk | Cost | MIT-safe | Recommendation |
|---|---|---|---|---|---|---|
| **Tavily** | Strong snippets, often includes profile URLs | Good company bios and domains | Low — search API, no LinkedIn login | Usage-based, mid | Yes (our client, their ToS) | **Start — person / company** |
| **Brave Search API** | Medium (SERP titles) | Strong for events, venues, news | Low | Low vs Google/Serp | Yes | **Start — general / events** |
| **Google Programmable Search** | Medium | Strong, familiar ranking | Low | 100 queries/day free, then paid | Yes | Later fallback, same `SearchAdapter` |
| **SerpAPI** | High | High | Gray — wraps other engines | High | Client is fine; not worth it | Skip |
| **LinkedIn official API** | Identity only (`openid`/`profile`/`email`) | None — no connections | None if we stay in scope | Free | Yes | **Identity-only** (#101). Not a graph. |
| **Don't search / CSV only** | Whatever the file has | Company name string only | None | Free | Yes | **Keep** as the legal contact path. Not a substitute for public fact lookup. |
| **LinkedIn HTML scrape / session driver** | High and stolen | — | **Ban** of the user's own account | — | No | **Reject** |

---

## Storage (existing tables only)

- **Company / event / topic:** call the same `upsertCompany` / `upsertEvent` / `upsertTopic` in `packages/extractor/src/resolution.ts`. Domain from `companyDomain` is the company join key when present (already: `existingByDomain` then slug). Event `url` from `eventUrl` or evidence. Lazy promotion unchanged (`observedCount`, `promotedAt` at 2).
- **People:** insert or update `entity` with `ownerUserId = ctx.user.id`, `kind = 'person'`. Facts: `email`, `linkedin`, `notes`, `phone`, `url`, `source_url`, `fingerprint`. Confidence: user-stated or import = 95; web-filled = 70. Stamp `sourceInteractionId` on capture; imports stay null as they do today.
- **Edges:** `entity_company.role` from `role`; `entity_event` from `event` after upsert.
- **Never** copy web bios onto another owner's entity. Never write a person row without `ownerUserId`. Never persist raw Brave/Tavily/Google JSON.
- **`identity_claim`:** WP7 reads verified claims. Writing claims stays #101 (LinkedIn sign-in) / future user settings.

`importSource` stays `linkedin:<batchId>` / `vcard:<batchId>` / `device:<batchId>` / `voice-capture`. Web fill does not invent a new import source; it is an enrichment of an existing row.

---

## Privacy

Web fetch is about **public pages**. Store a URL, a time, a short snippet, a fingerprint — not HTML, not other attendees, not another user's notes.

- Query text = this owner's transcript extract or this owner's import row.
- Do not use user A's private `entity_fact` values as a search query for user B.
- Do not attach "also seen with …" people from a search snippet onto the shared `event` row.
- Fingerprint equality across users is allowed for *canonical* company/event and for an opt-in claim *check*. It is not consent.
- Magic-link tokens and session cookies stay out of this pipeline. No logging of emails or LinkedIn URLs at info level (use `packages/logger` once #12 lands; until then, no `console.log` of PII).

---

## Placement

| When | Where |
|---|---|
| WP1–4 | `apps/app/lib/enrich/` — `persona.ts`, `fingerprint.ts`, `matchLocal.ts`, `adapters/brave.ts`, `adapters/tavily.ts`, `adapters/types.ts` |
| WP5–6, two consumers | promote to `packages/enrich` (`@wingmic/enrich`), imported by `apps/app`. Extractor does **not** import enrich; capture maps `PersonaDraft` → `PersonCandidate` / `CompanyCandidate` / `EventCandidate` in the app router, then `commit()` as today. |
| Never | `packages/extractor` calling HTTP search. Extractor stays LLM + resolution. |

This issue is the roadmap entry that allows `packages/enrich`. Do not add the package in the first PR.

---

## Work packages

- [ ] **WP0** — file this issue + sub-issues; labels `wedge:imports`, `type:feat`, `p2`; parent #100 / leftover of #10.
- [ ] **WP1** — `PersonaDraft` Zod, `canonicalizePersona`, `fingerprint()` helper, vitest with Ada Lovelace fixtures only.
- [ ] **WP2** — local matcher: `PersonaDraft` → `ImportContactDraft` → existing `matchContacts` indexes; tests for email / linkedin / name-only ambiguous / foreign-identifier skip.
- [ ] **WP3** — Brave `SearchAdapter` (event + general). Map SERP to `PersonaDraft`. No vendor JSON in DB. Skip if API key unset.
- [ ] **WP4** — Tavily `SearchAdapter` (person + company). Same mapping rules. LinkedIn URLs kept as strings, never fetched.
- [ ] **WP5** — capture hook: after extract, if a person has `linkedin` or `name+companyHint`, run tiers 1–3, then 4 on miss. Merge into candidates; `commit()` unchanged besides extra facts.
- [ ] **WP6** — import enrichment, optional / env-gated: after parse, fill missing LinkedIn or company domain; preview still owner-scoped; undo still `importSource`.
- [ ] **WP7** — platform `identity_claim` check (verified only). Return `{ userId, claimId }` to the caller. No `entity_resolution` write.

One change per PR. Tests on every new path. `bun run typecheck && bun run lint && bun run test` before commit.

---

## Open questions (human call)

1. **Package timing.** Start in `apps/app/lib/enrich` and cut `@wingmic/enrich` only when WP5 and WP6 both import it, or create the package on WP1 because this issue already authorizes it?
2. **Capture write vs confirm.** Auto-write web-filled `linkedin` / `source_url` / `company.domain` on commit (confidence 70), or a confirm chip in chat first? Auto-write is faster; a wrong Ada is worse than a sparse row.
3. **Tavily-found LinkedIn URLs.** Treat as strong identity keys (same rank as a user-stated URL — fingerprints converge) or as weak evidence until the user confirms? Strong keys help company/event convergence; a bad hit attaches the wrong profile to the owner's person.

---

## Acceptance (epic)

- Same Ada + Acme from a memo and a CSV produce the same `fp:v1:…` once a strong key exists; person rows stay per owner.
- Canonical `company` / `event` converge via slug/domain; `observedCount` moves.
- User B's recall never surfaces user A's people or facts.
- No LinkedIn HTML fetch in the repo. Missing search keys degrade to local-only.
- `identity_claim` hits do not write `entity_resolution`.
- Adapters persist only `PersonaDraft` fields, never vendor payloads.
