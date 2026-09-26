// packages/bay/src/sources.ts
// ONE source interface for the ingest job. every source emits raw records into
// the shared normalize → merge pipeline — a source never writes, never knows
// about the store, and a down source contributes an error line, never a failed
// run. the db job (packages/db/scripts/bay-ingest.ts) runs exactly the list
// baySources() returns, in this order: the source ladder of the merged spec.

import { eventbriteSource, lumaSource, seedSource } from "./ingest.js";
import { feedsSource, submissionsSource, type FeedConfig } from "./feeds.js";
import { meetupSource, type MeetupCredentials } from "./meetup.js";
import type { IngestSourceResult } from "./types.js";

export interface BaySourceContext {
  /** ISO instant for fetchedAt/firstSeenAt stamps. */
  now: string;
  fetchImpl: typeof fetch;
  fetchTimeoutMs: number;
}

/** One ingest source. fetch() is total: it returns a result with errors, never
 * throws — the job's try/catch is a last resort, not the isolation mechanism. */
export interface BaySourceAdapter {
  name: string;
  fetch(ctx: BaySourceContext): Promise<IngestSourceResult>;
}

// adapters: wrap the pure fetchers in the interface so callers never special-case.
export function makeSeedSource(): BaySourceAdapter {
  return { name: "seed", fetch: () => Promise.resolve(seedSource()) };
}

export function makeLumaSource(opts: { cities?: string[]; fetchImpl?: typeof fetch; fetchTimeoutMs?: number; now?: string } = {}): BaySourceAdapter {
  return {
    name: "luma",
    fetch: (ctx) => lumaSource({ cities: opts.cities ?? ["sf"], fetchImpl: opts.fetchImpl ?? ctx.fetchImpl, fetchTimeoutMs: opts.fetchTimeoutMs ?? ctx.fetchTimeoutMs, now: opts.now ?? ctx.now }),
  };
}

export function makeMeetupSource(opts: { credentials: MeetupCredentials | null; fetchImpl?: typeof fetch; fetchTimeoutMs?: number; budget?: import("./meetup.js").PointBudget; now?: string }): BaySourceAdapter {
  return {
    name: "meetup",
    fetch: (ctx) =>
      meetupSource({
        credentials: opts.credentials,
        fetchImpl: opts.fetchImpl ?? ctx.fetchImpl,
        fetchTimeoutMs: opts.fetchTimeoutMs ?? ctx.fetchTimeoutMs,
        ...(opts.budget ? { budget: opts.budget } : {}),
        now: opts.now ?? ctx.now,
      }),
  };
}

export function makeFeedsSource(opts: { config?: FeedConfig; fetchImpl?: typeof fetch; fetchTimeoutMs?: number; now?: string } = {}): BaySourceAdapter {
  return {
    name: "feeds",
    fetch: (ctx) => feedsSource({ config: opts.config, fetchImpl: opts.fetchImpl ?? ctx.fetchImpl, fetchTimeoutMs: opts.fetchTimeoutMs ?? ctx.fetchTimeoutMs, now: opts.now ?? ctx.now }),
  };
}

export function makeSubmissionsSource(records?: unknown[]): BaySourceAdapter {
  return { name: "submissions", fetch: () => Promise.resolve(submissionsSource(records)) };
}

export function makeEventbriteSource(): BaySourceAdapter {
  return { name: "eventbrite", fetch: () => Promise.resolve(eventbriteSource()) };
}

export interface BaySourceOptions {
  fetchImpl?: typeof fetch;
  fetchTimeoutMs?: number;
  now?: string;
  /** Luma city slugs (default "sf" — the discover endpoint's own default). */
  cities?: string[];
  /** Null when MEETUP_* env is unset → the source skips with a summary line. */
  meetup?: MeetupCredentials | null;
  meetupBudget?: import("./meetup.js").PointBudget;
  /** Checked-in curated feed list by default; injectable for tests. */
  feeds?: FeedConfig;
  submissions?: unknown[];
}

/** The ingest ladder in spec order: seed first (the curated floor), then live
 * sources (luma keyless, meetup behind the key, feeds, submissions), then the
 * eventbrite stub. Order is presentation only — merge makes it irrelevant. */
export function baySources(opts: BaySourceOptions = {}): BaySourceAdapter[] {
  return [
    makeSeedSource(),
    makeLumaSource({ cities: opts.cities, fetchImpl: opts.fetchImpl, fetchTimeoutMs: opts.fetchTimeoutMs, now: opts.now }),
    makeMeetupSource({
      credentials: opts.meetup ?? null,
      fetchImpl: opts.fetchImpl,
      fetchTimeoutMs: opts.fetchTimeoutMs,
      ...(opts.meetupBudget ? { budget: opts.meetupBudget } : {}),
      now: opts.now,
    }),
    makeFeedsSource({ config: opts.feeds, fetchImpl: opts.fetchImpl, fetchTimeoutMs: opts.fetchTimeoutMs, now: opts.now }),
    makeSubmissionsSource(opts.submissions),
    makeEventbriteSource(),
  ];
}

/** The exit convention (locked decision, carried from the flat-file pipeline):
 * non-zero only when at least one source was attempted and EVERY attempted
 * source failed — contributed nothing and complained. A skipped source is
 * neither attempted nor failed, so an all-skip run exits 0 with a summary. */
export function ingestExitCode(results: IngestSourceResult[]): 0 | 1 {
  const attempted = results.filter((r) => !r.skipped);
  if (attempted.length === 0) return 0;
  const failed = attempted.filter((r) => r.records.length === 0 && r.errors.length > 0);
  return failed.length === attempted.length ? 1 : 0;
}
