# Config-driven public web search

**Date:** 2026-08-18 · **Status:** locked · **Base:** `staging`  
**Issue:** #132 · **Parents:** #118, #119

Supersedes the Brave + Tavily split in `2026-08-18-identity-fingerprint-search-design.md` and the Brave-only event enrich path in `2026-08-18-events-acts-identity-v2.md`.

## Lock

- **Brave Search is not used.** It is paid; do not add `BRAVE_SEARCH_API_KEY`.
- **One interface:** `WebSearchProvider` (`search` + `extract`). Intents: person, company, event, general, profile.
- **First vendor: Tavily** (`POST /search`, `POST /extract`, bearer `TAVILY_API_KEY`).
- **Swap:** `WEB_SEARCH_PROVIDER=tavily | exa | none`. Adding Exa is a new file + one `switch` case in `createProvider.ts`. Call sites stay on the interface.
- Missing Tavily key or `none` → skip web (local graph still works).
- Never persist vendor JSON. Never first-party GET LinkedIn HTML (`isBlockedExtractUrl`).
- Adapters take keys via constructor. `process.env` only in `apps/app/lib/config/env.ts`.

## Not in this slice

Capture wiring, event enrich job, fingerprint merge — those consume `webSearchProviderFromEnv()` in later PRs.
