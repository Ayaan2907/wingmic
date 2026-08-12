# Homepage gap fill — design

**Date:** 2026-08-12 · **Status:** approved (`go`) · **Base:** `staging`

## Intent

Keep **wingmic.xyz** promises intact. Fill every promised product gap in `apps/app` (and supporting packages). Do not strip marketing copy.

## Env-gated connectors (locked)

OAuth / provider Connect buttons ship **full UX + server paths**. Without `PROVIDER_*` secrets, Connect shows a clear configure state — never fake “connected”.

## Streams (one PR family each → `staging`)

| Stream | Scope |
|---|---|
| **A · PDF truth** | Soft empty (#88), chat history hydrate, live Chat/Person rails, home polish, imports entry, topic guard, chat tab active |
| **B · Imports** | I6 resolve-on-import, I7 badges, I8 undo, I4 device contacts; LinkedIn CSV + OAuth scaffold; Google People when keys set |
| **C · Acts** | Pending/Sent/All filters, person follow-ups from acts, A5 `whenHint` scheduling, richer draft kinds |
| **D · Public API** | REST capture/nodes/edges/query/followups, `@wingmic/sdk`, outbound webhooks |
| **E · MCP** | Read tools: query, list people/companies; optional capture |
| **F · Connectors** | Per-provider Connect UI + OAuth/callback → same import upsert; Coming soon until keys live |
| **G · Streaming** | SSE for capture/extract progress |

## Non-goals (blocked on external)

Production OAuth client IDs, Apple iCloud, WhatsApp Business approval, Zapier app listing — code + docs land; secrets turn Connect green.

## Acceptance (program)

- Homepage claims map to a real route, API, or env-gated Connect — no silent dead ends in the app.
- Chat refresh shows two-sided experience (user memo + agent card when extraction exists).
- Desktop rails use live data only (no Sarah/Acme fixtures).
- One change per PR; conventional commits; no AI trailers.
