// packages/bay/src/index.ts
// public surface of the bay core. zero runtime dependencies: everything here is
// typed code + data, per the merged product spec (locked decision 5).

export * from "./types.js";
export * from "./scoring.js";
export * from "./personas.js";
export * from "./contract.js";
export * from "./ingest.js";
export * from "./ratelimit.js";
export {
  WingmicAuthError,
  MockWingmicClient,
  MOCK_PROFILE,
  MOCK_PEOPLE,
  overlapSafely,
} from "./client.js";
export {
  READ_CACHE_CONTROL,
  readBay,
  personaView,
  capabilities,
  scoreEvent,
  roundFor,
} from "./service.js";
export type { Capabilities, ScoreEventDeps, ScoreEventInput } from "./service.js";
