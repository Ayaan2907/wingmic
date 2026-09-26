# @wingmic/bay

the bay core: persona weights, the data contract, and the deterministic scoring
engine, ported from the ayaan-site `/bay` surface (repo `Ayaan2907/ayaan-site` at
`1bca780`) into the wingmic monorepo. zero runtime dependencies - the old engine
was dependency-free and stays that way.

## modules

- `src/scoring.ts` - the score pipeline: fnv-1a feature-hashing retrieval, the
  fixed-weight typed scorer (go >= 0.6, skip < 0.4), the clamped llm explain, and
  deterministic fallback templates. pure: no env, no fetch, no log.
- `src/personas.ts` - the one weights module for server ranking and map emphasis,
  with the CANON vocabulary fold. deterministic; ties break by id.
- `src/contract.ts` - record shapes, `normalizeRecord`, expiry with the 24h grace,
  idempotent `mergeRecords` (earliest `firstSeenAt` survives), and the file-store
  io (default adapter until the data layer swaps turso in behind it).
- `src/ingest.ts` - sources (seed, luma keyless, eventbrite stub) feeding the
  contract; fetch injectable; per-source error isolation; idempotent.
- `src/client.ts` - the internal service boundary (getProfile / networkOverlap /
  verify / capture), the mock client and fixtures (demo networks, always labeled),
  and the degrade-to-`[]` rule.
- `src/service.ts` - the score pipeline at service level: viewer resolution, rank,
  typed anchor, clamped explain, plus the read model (`readBay`, `personaView`)
  and the capabilities probe. the router maps outcomes to http.
- `src/ratelimit.ts` - sliding-window limiter + daily cap, storage-agnostic.

## environment

this package reads no environment variables (enforced by `src/env-docs.test.ts`):
configuration arrives through function arguments, and the callers own env parsing.
if a future change reads an env var, that test fails until the read is documented
in this section - the env-doc sync rule, carried from the old repo's check.

## tests

`bun run test` (vitest). the pins are the old engine's behavioral guarantees:
deterministic scoring, stable persona rankings, idempotent merge, serve-time
expiry, honest errors, and the unslop copy scan.
