# Events via search · dynamic acts · platform identity handshake — v2 spec

**Date:** 2026-08-18 · **Status:** finalized with marked open calls · **Base:** `staging`
**Supersedes:** the ICS/calendar-subscription portion of #104 (its convergence keys, privacy tiers, and `event.external_*` migration survive). Consumes `WebSearchProvider` from `2026-08-18-web-search-provider.md` (#132).
**Parent:** #100.

---

## 0. Direction locked by the founder (2026-08-18)

1. **No calendar links, no ICS.** Users will not paste feeds. Event details come from
   *search* (Tavily via `WebSearchProvider`), general facts only — date, location, official URL. Never attendees.
2. **Acts must be dynamic.** A `.ics` download is not a product. Acts should schedule
   themselves and come back to the user.
3. **Platform identity must do something.** If Ayaan records "met X, he works at Acme"
   and X is a signed-up user, silence is a wasted network effect. Define exactly what
   each side sees.

---

## 1. Events: search, not subscribe

### 1.1 Flow

```
memo mentions "ETH Denver"          pasted lu.ma/partiful URL in chat
        │                                      │
        ▼                                      ▼
upsertEvent (canonical, slug)   ←──── external_id from the URL
        │
        ▼  async job: event_enrich (skip if url+dates already set)
webSearch.search({ intent: 'event', q: '<event name> <year?>' })
optional extract() on the official URL (never LinkedIn)
        │
        ▼
write onto the CANONICAL event row, confidence 70:
  url (official site) · date_range_start/end · location ·
  external_source/external_id when a lu.ma / partiful URL appears in results
never: attendees, rosters, counts, other users' anything
```

- Enrich is **tier-4 discipline** from the fingerprint spec: async, env-gated
  (`TAVILY_API_KEY` missing or `WEB_SEARCH_PROVIDER=none` → skip silently).
  Search snippets plus Tavily extract on non-LinkedIn URLs. Never first-party HTML GET of LinkedIn.
- User-stated fields are never overwritten by web-filled fields; web fills blanks only.
- Recurring private meetings ("weekly standup") will find no clean public hit —
  enrich writes nothing. That is correct; do not force it.

### 1.2 Memo → event mapping (no calendar needed)

Signals, in order:

1. **Speech names the event** — today's path, unchanged.
2. **Pasted event URL** in chat → attach + store external id. Strongest key.
3. **Time window**: `capturedAt` falls inside the (web-enriched) `date_range` of an
   event this user already has an `entity_event` edge to.

Attach behavior:

- exactly **one** window candidate **and** the user has attended it before
  → **auto-attach with visible undo** ("mapped to *ETH Denver* · undo").
- two or more candidates, or a first-time event → **chip asks**, never silent.
- zero candidates → nothing. No guessing from name similarity alone.

> **Open call OC-1:** auto-attach on exactly-one (default, chosen here) vs always-ask.
> #104 said always-ask; founder direction says automatic. Default: auto + undo.

### 1.3 Keeps from #104

- `event.external_source` (`luma | partiful | web | null`) + `external_id`,
  unique pair, new migration. Convergence: two users, one Luma URL → one row.
- Name normalization ("ethdenver" / "ETH Denver" / "ETHDenver 2026" → one slug family).
- Privacy tiers verbatim: event node shared; attendance, memos, people stay owner-scoped.

### 1.4 Dropped from #104

- ICS/webcal subscription, calendar polling, onboarding calendar field, Google
  Calendar OAuth follow-up. If a calendar source ever returns, it is a new issue.

---

## 2. Acts: scheduled and context-aware, not a file download

### 2.1 Why `.ics` download dies as the flagship CTA

It was the permission-first stopgap: no send infra, so we handed the user a file.
For a **meeting** an "add to calendar" file has residual value (it puts the meeting on
their own calendar) — keep it as a secondary affordance on `meeting` acts only.
For reminders/follow-ups it is dead weight. Remove it as the primary CTA.

### 2.2 The dynamic model

An act is a row that **wakes up**:

1. **Commit time** — `whenHint` parses to `runAt` (ISO or natural language via the
   existing draft agent; fallback +24h). Event-derived acts get `runAt =
   event.date_range_end + 1 day` ("check-ins after ETH Denver").
2. **Scheduler tick** — a protected route (`/api/cron/acts`, `CRON_SECRET` header)
   hit by Railway cron. Due acts (`status IN (drafted, snoozed) AND runAt <= now`)
   trigger a **Resend email to the account owner**: "follow-up due: *coffee with Ada*",
   deep-linking `/acts`. Infra already exists (magic-link sender). No OAuth, no
   third-party calendar.
3. **Act CTAs** — `email`/`intro`: `mailto:` prefilled from the target entity's
   `email` fact (exists). `meeting`: mailto + secondary add-to-calendar. `reminder`/
   `todo`: done / snooze (snooze sets `runAt`, wakes again).
4. **Graph context in drafts** — draft agent gets the person's facts + the event
   window, so "send deck after the conf" schedules itself off the enriched date.

Out of scope (separate epic, dangerous surface): sending from the user's own mailbox
(Gmail/Outlook OAuth), Slack/WhatsApp delivery, automation without a human tap.

> **Open call OC-2:** notification granularity. Default: one email per due act,
> max 1 digest/day when >3 due. Alternative: daily digest always.

---

## 3. Platform identity: the "X is already signed up" case

### 3.1 What is true today (by design, not omission)

Ayaan's memo creates a **private** `entity` "X" in Ayaan's graph. X's **account**
(`user`, `identity_claim`) is a different row. Nothing connects them. The dormant
tables (`identity_claim`, `entity_resolution`, `connection_request`) were built for
exactly this moment.

### 3.2 What we ship

```
Ayaan's entity "X" gains a strong fact (email or linkedin, voice or import)
        │  async identity job — after local merge tiers
        ▼
probe identity_claim WHERE verified=1 AND kind+normalized value match
(also user.email when emailVerified — magic link already verifies it)
        │ hit
        ▼
badge on Ayaan's person card: "may be on wingmic"  → [request connect]
        │ Ayaan taps
        ▼
connection_request(from: ayaan, to: x, entityId, status: pending)
Resend email to X: "Ayaan says you met — connect on wingmic?"
        │ X accepts                                │ X declines / ignores
        ▼                                          ▼
entity_resolution(resolvedUserId=X,          request stays "requested" for
mutualConsentTs=now)                         Ayaan forever (30d expiry);
· Ayaan's card: "on wingmic ✓"               decline is indistinguishable
· X's public:true claims render on           from not-on-platform
  Ayaan's card (X controls the set)
· optional reciprocal: X gets an entity
  "Ayaan · met at <event>" in X's graph      (v2.1, behind accept)
```

### 3.3 Hard rules

- **Match key = verified strong id only.** Verified `identity_claim` (email/linkedin)
  or verified `user.email`. Never name, never name+company, never embeddings.
  Onboarding's self-typed LinkedIn URL is `verified=false` → not a match key.
- **Probe direction:** only from identifiers **Ayaan already stored** as facts on his
  own entity. Constant-time indexed lookups (`identity_claim_kind_value_idx`),
  normalized with the fingerprint recipe (`email:…`, `linkedin:linkedin.com/in/…`).
- **Zero data leaks pre-consent.** The badge reveals possible-membership to the person
  who *already holds the identifier* — nothing else. No name, avatar, graph, or
  activity of X. Request email to X carries Ayaan's name and nothing from the memo.
- **Anti-enumeration:** probes run only in the async job over committed facts; per-user
  daily cap; no API (tRPC/REST/MCP) that answers "is this email a user".
- **X's controls:** `discoverable` toggle (settings; when off, probes never match X),
  per-claim `public` flag (already in schema) decides what Ayaan sees post-accept.

> **Open call OC-3:** request email shows Ayaan's name (default: yes — anonymous
> "someone met you" is creepier and unactionable) vs anonymous-until-accept.
> **Open call OC-4:** `discoverable` default ON (WhatsApp semantics: finder must
> already hold your id — default, chosen) vs OFF (invisible until opt-in).

### 3.4 What we still never do

Cross-user auto-merge, attendee rosters on events, X's graph visible to Ayaan,
matching from another user's private facts, LinkedIn scraping.

---

## 4. Build order (one PR per WP, issue-first)

| WP | What | Depends on |
|---|---|---|
| V1 | `event.external_source/external_id` migration + slug normalization | — |
| V2 | `WebSearchProvider` event intent (Tavily default) + `event_enrich` async fill | V1, #132 |
| V3 | Memo↔event window attach (auto-1 + undo, chip on many) | V2 |
| V4 | `whenHint → runAt` at commit + `/api/cron/acts` + Resend due-nudge | — |
| V5 | Act CTAs rework: mailto primary, meeting-only add-to-calendar, snooze wakes | V4 |
| V6 | Identity probe job (verified claims) + person-card badge | fingerprint WP1–2 |
| V7 | `connection_request` send/accept/decline + Resend invite + consent render | V6 |
| V8 | `discoverable` setting + per-claim public controls | V7 |

Gate per WP: `bun run typecheck && bun run lint && bun run test`. People-privacy tests
mandatory on V6–V8 (user B never surfaces from user A's facts without verified claim +
consent).

---

## 5. Acceptance (epic)

- Saying "met ada at ethdenver" enriches the ETH Denver node with real dates + URL from
  search, and the next memo inside that window offers/attaches the event — with zero
  calendar setup.
- No attendee data exists anywhere in the DB.
- A "send deck tomorrow" act emails the owner tomorrow and deep-links a working draft.
- `.ics` download appears only on meeting acts, never as the primary CTA.
- When X is signed up (verified email/LinkedIn) and Ayaan holds that identifier, Ayaan
  sees "may be on wingmic", a consented handshake links them, and X's public claims —
  only those — render on Ayaan's card.
- Declines are invisible. Probes cannot enumerate users. `discoverable=false` users
  never match.
