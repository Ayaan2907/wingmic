// The browser-safe surface: record types, deterministic scoring, persona
// weights. The root barrel also re-exports server modules (contract.ts's
// flat-file io touches node:fs), so client bundles must import the pure core
// through @wingmic/bay/core — one weights file serves both sides, and only
// this subpath is safe to pull into the browser.
export * from './types.js';
export * from './scoring.js';
export * from './personas.js';
