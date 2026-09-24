# @wingmic/mcp

Model Context Protocol server for the [wingmic](https://app.wingmic.xyz) network —
lets any MCP client (Claude Desktop, MCP Inspector, your agent stack) search,
capture, and follow up on your personal network through the wingmic public REST
API v1 (`docs/api.md`). The MCP tools are protocol wrappers over REST v1: no
duplicated business logic, same scoped bearer API keys.

## Setup

1. Create a scoped API key in the [wingmic dashboard](https://app.wingmic.xyz/dashboard).
   Keys look like `wk_live_…` and carry scopes.
2. Configure your MCP client:

```json
{
  "mcpServers": {
    "wingmic": {
      "command": "npx",
      "args": ["-y", "@wingmic/mcp"],
      "env": {
        "WINGMIC_API_URL": "https://app.wingmic.xyz",
        "WINGMIC_API_KEY": "wk_live_your_key"
      }
    }
  }
}
```

Environment:

| Variable          | Default                   | Meaning                                   |
| ----------------- | ------------------------- | ----------------------------------------- |
| `WINGMIC_API_URL` | `https://app.wingmic.xyz` | REST v1 base URL (override for local dev) |
| `WINGMIC_API_KEY` | — (required)              | Bearer key; missing scope → per-tool 403  |

## Tools

| Tool              | What it does                                             | REST v1 endpoint            | Scope           |
| ----------------- | -------------------------------------------------------- | --------------------------- | --------------- |
| `search_network`  | Semantic recall: "who do I know that ships Rust?"        | `GET /api/v1/recall`        | `search:read`   |
| `log_interaction` | Capture an interaction via the extraction pipeline       | `POST /api/v1/capture`      | `capture:write` |
| `get_person`      | Person by name + graph neighborhood (orgs/events/topics) | `GET /people`, `GET /graph` | `graph:read`    |
| `create_followup` | Create a follow-up (captured through the same pipeline)  | `POST /api/v1/capture`      | `capture:write` |

`get_person` covers the most recent 100 people by name; when no listed person matches it falls back
to semantic recall, which additionally needs the `search:read` scope — without it the tool reports
"no match" instead of erroring.

Error behavior:

- A key missing a scope gets a **tool-level error naming the missing scope**
  (from the API's 403 `insufficient_scope` contract) — not a silent degradation.
- Rate limiting (429, 60 req/key/min) surfaces as a retryable tool error with
  the API's `Retry-After` hint.
- The API key is only sent in the Authorization header and never appears in
  errors, logs, or tool output.

## Development

```bash
bun install            # from the repo root
bun run typecheck      # tsc --noEmit
bun run test           # vitest — client, per-tool scope, protocol conformance
bun run build          # tsup ESM + d.ts
bun run smoke          # builds, then a scripted MCP client run against a local REST v1 stub
```

The smoke script (`scripts/smoke.ts`) boots a stub REST v1 API on
`127.0.0.1:8974` implementing the documented contract, spawns the built stdio
server, connects a real MCP SDK client, and exercises all four tools. Point it
at a live dev instance with `WINGMIC_SMOKE_URL=http://localhost:3000`.
