# wingmic public API (v1)

The REST surface at `app.wingmic.xyz/api/v1` gives external tools read access
to your graph, write access to capture, and semantic recall — the same
services the app itself uses. Keys are managed in the
[dashboard](https://app.wingmic.xyz/dashboard).

## Auth

Every endpoint expects a bearer key:

```
Authorization: Bearer wk_live_xxxxxxxxxxxxxxxx…
```

Keys look like `wk_live_<base64url>`. The full key is shown **exactly once**
at creation — wingmic stores only a sha256 digest, so a lost key cannot be
recovered. Revoke it in the dashboard and create a new one.

Raw keys are never logged. Treat them like passwords.

## Scopes

| Scope           | Grants                                              |
| --------------- | --------------------------------------------------- |
| `graph:read`    | `GET /api/v1/graph`, `GET /api/v1/people`           |
| `capture:write` | `POST /api/v1/capture`                              |
| `search:read`   | `GET /api/v1/recall`                                |

A valid key without the endpoint's scope gets a **403 that names the missing
scope**:

```json
{
  "error": {
    "code": "insufficient_scope",
    "message": "key is missing the required scope: search:read",
    "missingScope": "search:read"
  }
}
```

A missing, unknown, or revoked key gets **401** (`unauthorized`) — the
response does not distinguish unknown from revoked.

## Rate limits

**60 requests per key per 60-second window** (fixed window). The counter is
**DB-backed** (the `api_rate_window` table, one atomic upsert per request):
it survives deploys and is correct across horizontally scaled instances —
not per-instance memory. Over the limit you get **429** with a `Retry-After`
header (seconds until the window resets).

## Endpoints

### GET /api/v1/graph — scope `graph:read`

Whole-graph payload shaped for network rendering: your people as nodes plus
the orgs, events, and topics reachable through them.

```bash
curl -H "Authorization: Bearer $WINGMIC_KEY" \
  https://app.wingmic.xyz/api/v1/graph
```

```json
{
  "nodes": [
    { "id": "…", "kind": "person", "label": "Sarah" },
    { "id": "…", "kind": "company", "label": "Acme" }
  ],
  "links": [
    { "source": "…", "target": "…", "rel": "works_at" }
  ]
}
```

`rel` is one of `works_at`, `attended`, `discussed` (`hub: true` marks
topic-hub links).

### GET /api/v1/people — scope `graph:read`

Your people, most recently touched first. Optional `?limit=` (1–100,
default 40).

```bash
curl -H "Authorization: Bearer $WINGMIC_KEY" \
  "https://app.wingmic.xyz/api/v1/people?limit=5"
```

```json
{
  "people": [
    { "id": "…", "name": "Sarah Chen", "importSource": "voice-capture" }
  ]
}
```

### POST /api/v1/capture — scope `capture:write`

Commit a memo: runs the same hybrid extraction pipeline as the app and
persists the resolved entities, facts, topics, and follow-ups.

```bash
curl -X POST -H "Authorization: Bearer $WINGMIC_KEY" \
  -H "Content-Type: application/json" \
  -d '{"transcript": "grabbed coffee with Sarah Chen at Acme — she works on edge config, follow up next week"}' \
  https://app.wingmic.xyz/api/v1/capture
```

Optional fields: `capturedAt` (ISO date), `clientCaptureId` (retry
idempotency — same id returns the existing interaction), `attachment`
(`{ "jpegBase64": "…" }`, ≤ ~600 KB JPEG).

Reply: `extracted` (persons/companies/events/topics/actions), `interactionId`,
`entityIds`, `attachments`.

Extraction needs the extraction LLM key configured; without it the commit
fails with `internal_error` rather than capturing a partial graph.

### GET /api/v1/recall — scope `search:read`

Natural-language recall over your graph. Required `?q=` (1–500 chars),
optional `?limit=` (1–50, default 10).

```bash
curl -H "Authorization: Bearer $WINGMIC_KEY" \
  "https://app.wingmic.xyz/api/v1/recall?q=who%20ships%20rust&limit=3"
```

```json
{
  "entities": [
    {
      "id": "…",
      "name": "Marco Diaz",
      "aliases": [],
      "score": 0.91,
      "companies": [{ "id": "…", "name": "Acme", "domain": null, "role": "infra" }],
      "events": [],
      "topics": [{ "id": "…", "name": "rust" }],
      "facts": [{ "key": "linkedin", "value": "…", "confidence": 90 }]
    }
  ],
  "durationMs": 42,
  "mode": "semantic"
}
```

`mode` is `semantic` (vector recall) or `text` (keyword fallback when the
embedding path is unavailable) — same contract as in-app recall.

## Errors

All errors share one shape: `{"error": {"code": "…", "message": "…"}}`,
plus `missingScope` on 403. Codes: `unauthorized` (401),
`insufficient_scope` (403), `rate_limited` (429, with `Retry-After`),
`bad_request` (400 — invalid body or input), `not_found` (404),
`internal_error` (500). Input validation errors come from the same zod
schemas the app uses.

## Security notes

- Keys are stored as sha256 digests; lookups are by digest, compared with
  `timingSafeEqual`.
- Revocation is permanent (`revokedAt` set — no un-revoke); revoked keys
  fail auth immediately.
- Every request is scoped to the key's owner — an endpoint can never read
  or write another user's graph.
- Per-key rate limits protect the shared database; keys are revocable in
  the dashboard the moment one leaks.
