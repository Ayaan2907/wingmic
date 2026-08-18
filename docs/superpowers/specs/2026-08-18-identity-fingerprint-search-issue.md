# [epic](enrich): web search adapters + person fingerprint for capture/import

**Parent:** #100 (leftover of #10)  
**Labels:** `wedge:imports`, `type:feat`, `p2`  
**Spec:** `docs/superpowers/specs/2026-08-18-identity-fingerprint-search-design.md`

this issue is the roadmap ticket that later allows `packages/enrich` (start in `apps/app/lib/enrich` until capture and import both consume it).

## why

capture already pulls a LinkedIn URL or a name+company out of a 10–30s memo. import already has email / LinkedIn / name on a CSV row. neither looks at the public web, so company domains stay empty, events don't converge unless the slug matches character-for-character, and two owners who met the same Ada keep duplicate sparse rows with no shared *fingerprint*.

we want a small adapter that searches the public web *without* a LinkedIn session, normalizes hits into one `PersonaDraft`, hashes a ranked identity key, then:

1. match that person in *this* owner's graph
2. notice a verified `identity_claim` (opt-in only — do not auto-link)
3. write company/event through the canonical tables we already have

people stay private. Acme and ETH Denver stay shared.

## what we will *not* do

- scrape LinkedIn HTML or drive a logged-in session (ban risk; connections API has been gone since 2015)
- treat Sign In with LinkedIn as a graph — it grants `openid` / `profile` / `email` only (#101)
- replace CSV / vCard / device import as the legal contact path (#102)
- store attendee rosters from Luma, Partiful, calendars, or search snippets
- auto-write `entity_resolution` or `connection_request`
- invent a parallel people table or persist Brave/Tavily/Google JSON
- add `packages/enrich` in the first PR (this issue authorizes it for a later cut)

## alignment with existing schema

reuse, don't parallel:

- **`user`** — BetterAuth account holder. `name` is one nullable string, not first/last
- **`identity_claim`** — dormant. `kind`: email | linkedin | twitter | github | phone | url. indexed `(kind, value)`. WP7 *reads* `verified = true` only
- **`entity`** (`kind='person'`) — private, `ownerUserId`. `name`, `aliases`, `importSource`, embedding, `deletedAt`
- **`entity_fact`** — keys we already write: `email`, `linkedin`, `notes`. this epic adds `phone`, `url`, `source_url`, `fingerprint` as more keys on the same table
- **`company` / `event` / `topic`** — canonical. slug unique, `observedCount`, `promotedAt`. company also `domain`; event also `url`
- **`entity_resolution` / `connection_request`** — still dormant. do not write
- **`ImportContactDraft`** — `name`, `email?`, `linkedinUrl?`, `company?`, `role?`, `phone?`, `notes?`
- **`PersonCandidate`** — `name`, `aliases[]`, `role`, `companyHint`, `email`, `linkedin`, `notes`, `topics[]`
- **`matchContacts`** — email → linkedin → name. name-only is ambiguous. `filterSafeIdentifierFacts` keeps cross-entity identifier maps
- **capture `resolution.ts`** — `knownContacts` + email match + import boost; people never cross users; `upsertCompany` / `upsertEvent` lazy-promote

schema is locked. the adapter maps *into* these fields.

## fingerprint rule

hash the strongest identity *key*, not the whole blob. notes and evidence URLs must not change who this is.

rank (first hit wins):

1. `linkedin_url_normalized` — `isLinkedInHost`, lowercase path, strip `www.` / query / hash / trailing slash  
   `https://www.linkedin.com/in/ada-lovelace/?trk=foo` → key `linkedin:linkedin.com/in/ada-lovelace`
2. `email_lower` — trim + lowercase → key `email:ada@example.com`
3. `name_company` — collapsed lower name + (`companyDomain` without `www.` else `slugify(company)`) → key `name_company:ada lovelace|acme.dev`
4. `name_lower` — key `name:ada lovelace` — **never auto-merge** (same as import)

```
hash = sha256(utf8(key)).hex()
id   = fp:v1:${kind}:${hash}
strong = kind !== 'name_lower'
```

user A's memo and user B's CSV of the same Ada at Acme produce the same `id` once a strong key exists. each still owns a separate `entity` row. the `company` / `event` slug is the shared join. store `id` as `entity_fact.key = 'fingerprint'` on the owner's person — no global people index.

fake PII only in fixtures: Ada Lovelace, `ada@example.com`, `https://www.linkedin.com/in/ada-lovelace`.

## adapter contract

```ts
interface SearchAdapter {
  kind: 'brave' | 'tavily' | 'google_cse';
  search(query: SearchQuery): Promise<PersonaDraft[]>;
}
```

`PersonaDraft` is the field-union of `ImportContactDraft` + `PersonCandidate` + `entity_fact` keys + `{ sourceUrl, retrievedAt, adapterKind, snippet? }`. canonicalize `linkedin`/`linkedinUrl` and `company`/`companyHint` on parse.

pipeline, in order:

1. local owner-scoped `matchContacts`
2. local `identity_claim` lookup (verified only, no write)
3. canonical company/event slug (and company domain)
4. web adapter **only** on local miss / low confidence

query text comes from this user's memo or import row. never from another user's private facts. never GET LinkedIn HTML; a search hit that *is* a LinkedIn URL is stored as a string and normalized.

starting pair: Brave (events / general) + Tavily (person / company snippets). Google CSE later, same interface. LinkedIn official API is identity-only (#101), not this.

## comparison (short)

| approach | person | company/event | ToS / ban | cost | MIT-safe | rec |
|---|---|---|---|---|---|---|
| Tavily | high snippets | good bios/domains | low | mid | yes | **start — person/company** |
| Brave Search API | medium | high events/news | low | low | yes | **start — general/events** |
| Google CSE | medium | high | low | free tier then paid | yes | later fallback |
| SerpAPI | high | high | gray | high | client ok | skip |
| LinkedIn official | identity only | none | none in-scope | free | yes | #101, not graph |
| CSV / vCard only | file fields | name string | none | free | yes | keep as contact path |
| LinkedIn scrape | stolen | — | **ban** | — | no | **reject** |

## sub-issues / WPs

- [ ] **WP0** — this issue + tree (you are here)
- [ ] **WP1** — `PersonaDraft` Zod + `fingerprint()` + vitest (Ada fixtures)
- [ ] **WP2** — local matcher reuse of `matchContacts` (email / linkedin / name-only ambiguous / foreign identifier skip)
- [ ] **WP3** — Brave adapter (event + general) → `PersonaDraft[]`; skip if key unset
- [ ] **WP4** — Tavily adapter (person + company); LinkedIn URLs as strings, never fetched
- [ ] **WP5** — capture hook when `linkedin` or `name+companyHint` present; tiers 1–3 then 4; `commit()` still owns writes
- [ ] **WP6** — import enrichment optional / env-gated; undo still `importSource`
- [ ] **WP7** — verified `identity_claim` check; return `{ userId, claimId }`; no `entity_resolution` write

one change per PR. extractor does not call HTTP search — the app maps `PersonaDraft` onto `PersonCandidate` / `CompanyCandidate` / `EventCandidate` and reuses `resolution.ts`.

## acceptance criteria

- [ ] same Ada at Acme from a memo and a CSV produce the same `fp:v1:…` once a strong key exists; person rows stay per `ownerUserId`
- [ ] canonical `company` / `event` converge on slug (and company `domain` when known); `observedCount` increments
- [ ] user B's recall never surfaces user A's people or facts
- [ ] name-only fingerprints do not auto-merge
- [ ] identifier facts already owned by another *of this user's* entities are not copied
- [ ] no LinkedIn HTML fetch in the repo; missing search keys degrade to local-only
- [ ] adapters persist only `PersonaDraft` fields — never vendor payloads
- [ ] WP7 does not write `entity_resolution` or `connection_request`
- [ ] env keys optional; empty strings stripped via existing env module
- [ ] tests on WP1–2 at minimum; WP3–4 map fixtures without live keys

## out of scope

- Sign In with LinkedIn + writing the claim (#101)
- one-tap CSV UX (#102)
- event embeddings (#103) and calendar ingestion (#104)
- auto-linking people, connection requests, public profiles
- attendee lists, Luma/Partiful scrapes
- new top-level package in the first PR
- changing `user.name` into first/last
- editing eval fixtures or `design/` mocks
