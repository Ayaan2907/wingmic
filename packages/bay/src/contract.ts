// packages/bay/src/contract.ts
// The bay data contract: one record shape for events and places, the expiry rule, and
// the store io. Shared by the read api and the ingest so they cannot drift.
// Ported from ayaan-site api/_baydata.js (1bca780). The HTTP handler (storeHandler)
// retires — the wingmic router re-expresses it over these functions; the read model
// lives in service.ts.
//
// freshness honesty: every record carries source + fetchedAt. expiry is computed at
// serve time, not baked in: events die at expiresAt, else endsAt (or startsAt when no
// end is listed) + grace. places stay until someone removes them or sets expiresAt.

import fs from "node:fs";
import path from "node:path";

import type {
  BayRecord,
  NormalizeResult,
  RecordInput,
} from "./types.js";
import { BAY_CATEGORIES, BAY_SOURCES, BAY_TYPES } from "./types.js";
import seedEventsJson from "./data/seed/events.json";
import seedPlacesJson from "./data/seed/places.json";

// categories are the map's layers. the six are the launch set from the spec; "events"
// is the honest bucket for general luma listings that are none of the others (a random
// ai meetup is not a hackathon, and pretending otherwise poisons the map's layers).
export const CATEGORIES: readonly string[] = BAY_CATEGORIES;
export const TYPES: readonly string[] = BAY_TYPES;
export const SOURCES: readonly string[] = BAY_SOURCES;

// an event stays live this long past its last known moment. 24h: it is fresh the same
// night, gone the next morning.
export const EVENT_GRACE_MS = 24 * 60 * 60 * 1000;
export const TEXT_MAX: Record<string, number> = { title: 160, venue: 200, address: 300, note: 500, id: 120 };

const oneOf = <T extends string>(allowed: readonly T[], v: unknown): v is T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v);

const isBlank = (v: unknown): boolean => v == null || v === "";
const isIso = (v: unknown): boolean => typeof v === "string" && Number.isFinite(Date.parse(v));
const iso = (v: string | number | Date): string => new Date(v).toISOString();
const clampText = (v: unknown, max: number): string | undefined => {
  const s = String(v).trim();
  return s ? s.slice(0, max) : undefined;
};
const slugify = (s: unknown): string =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

// validate and normalize one input record: { ok, record } or { ok: false, error }.
// allow-listed fields only, dates canonicalized to utc iso, so the store never holds junk.
export function normalizeRecord(
  input: unknown,
  { now = new Date().toISOString() }: { now?: string } = {},
): NormalizeResult {
  if (!input || typeof input !== "object") return { ok: false, error: "record is not an object" };
  const r = input as RecordInput;
  const out: Record<string, unknown> = {};
  const bad = (m: string): NormalizeResult => ({ ok: false, error: m });

  if (!oneOf(BAY_TYPES, r.type)) return bad(`type must be one of ${BAY_TYPES.join("|")}`);
  out.type = r.type;
  if (!oneOf(BAY_CATEGORIES, r.category)) return bad(`category must be one of ${BAY_CATEGORIES.join("|")}`);
  out.category = r.category;
  const title = clampText(r.title, TEXT_MAX.title);
  if (!title) return bad("title is required");
  out.title = title;
  if (!oneOf(BAY_SOURCES, r.source)) return bad(`source must be one of ${BAY_SOURCES.join("|")}`);
  out.source = r.source;

  // id: stable per source. a re-ingest lands on the same id, which is what makes the
  // store idempotent (update in place, never duplicate).
  const rawId = isBlank(r.id) ? `${out.source}:${slugify(title)}` : String(r.id);
  // uppercase allowed: upstream ids are mixed-case (luma "evt-UScGHdEzFFjCto6") and
  // must be kept verbatim — case-folding them risks collapsing distinct events.
  if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,119}$/.test(rawId)) return bad(`id "${rawId}" is not a slug`);
  out.id = rawId;

  for (const k of ["venue", "address", "note"] as const) {
    if (isBlank(r[k])) continue;
    const v = clampText(r[k], TEXT_MAX[k]);
    if (v) out[k] = v;
  }
  for (const k of ["url", "sourceUrl"] as const) {
    if (isBlank(r[k])) continue;
    if (!/^https:\/\//.test(String(r[k]))) return bad(`${k} must be an https url`);
    out[k] = String(r[k]);
  }
  for (const k of ["lat", "lng"] as const) {
    if (isBlank(r[k])) continue;
    const n = Number(r[k]);
    if (!Number.isFinite(n)) return bad(`${k} must be a number`);
    if (k === "lat" && Math.abs(n) > 90) return bad("lat out of range");
    if (k === "lng" && Math.abs(n) > 180) return bad("lng out of range");
    out[k] = n;
  }
  for (const k of ["startsAt", "endsAt", "expiresAt"] as const) {
    if (isBlank(r[k])) continue;
    if (!isIso(r[k])) return bad(`${k} must be a parseable date`);
    out[k] = iso(r[k] as string);
  }
  if (out.type === "event" && !out.startsAt) return bad("events need startsAt");
  if (out.type === "place" && (out.startsAt || out.endsAt)) return bad("places do not take startsAt/endsAt");

  out.fetchedAt = isIso(r.fetchedAt) ? iso(r.fetchedAt as string) : iso(now);
  out.firstSeenAt = isIso(r.firstSeenAt) ? iso(r.firstSeenAt as string) : out.fetchedAt;
  return { ok: true, record: out as unknown as BayRecord };
}

// when a record stops being live. null = no expiry (a place without expiresAt).
export function expiryAt(
  record: Pick<BayRecord, "expiresAt" | "type" | "endsAt" | "startsAt">,
): number | null {
  if (record.expiresAt) return Date.parse(record.expiresAt);
  if (record.type !== "event") return null;
  const end = record.endsAt || record.startsAt;
  return end ? Date.parse(end) + EVENT_GRACE_MS : null;
}

export const isLive = (record: BayRecord, now: number = Date.now()): boolean => {
  const t = expiryAt(record);
  return t == null || t > now;
};

// serve-time filter: stale events drop out of the live layer automatically. the store
// keeps the full history (no silent deletes); the read api only serves the live set.
export function liveFilter(
  records: BayRecord[],
  now: number = Date.now(),
): { live: BayRecord[]; expiredCount: number } {
  const live: BayRecord[] = [];
  let expiredCount = 0;
  for (const r of records) {
    if (isLive(r, now)) live.push(r);
    else expiredCount++;
  }
  return { live, expiredCount };
}

export const sourcesOf = (records: BayRecord[]): string[] =>
  [...new Set(records.map((r) => r.source))].sort();

const stripFirstSeen = (r: BayRecord): Omit<BayRecord, "firstSeenAt"> => {
  const { firstSeenAt: _firstSeenAt, ...rest } = r;
  return rest;
};

// merge incoming into the store by id: update in place, never duplicate. the original
// firstSeenAt survives so provenance keeps its earliest sighting.
export function mergeRecords(
  existing: BayRecord[],
  incoming: BayRecord[],
): { records: BayRecord[]; created: number; updated: number } {
  const byId = new Map(existing.map((r) => [r.id, r]));
  let created = 0;
  let updated = 0;
  for (const r of incoming) {
    const prev = byId.get(r.id);
    if (!prev) {
      byId.set(r.id, r);
      created++;
      continue;
    }
    const next = { ...prev, ...r, firstSeenAt: prev.firstSeenAt || r.firstSeenAt };
    if (JSON.stringify(stripFirstSeen(prev)) !== JSON.stringify(stripFirstSeen(next))) updated++;
    byId.set(r.id, next);
  }
  const records = [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  return { records, created, updated };
}

/* ---------- store io ---------- */

// data/<type>.json, envelope { updatedAt, records }. gitignored at runtime;
// src/data/seed/*.json (committed, imported above) is the fallback so a fresh
// deployment serves a real bay before the first ingest lands. the file store is the
// default adapter until the data layer swaps it for turso behind the same functions.
// type here is the plural file key ("events" | "places") — do not append an "s".
export type StoreFileKey = "events" | "places";

export const storePath = (dataDir: string, type: StoreFileKey): string =>
  path.join(dataDir, `${type}.json`);

export interface StoreLoad {
  records: BayRecord[];
  errors: string[];
}

// reads a store file: records that pass the contract, plus the errors of the ones
// that do not (surfaced, never swallowed). null when the file does not exist.
function readRecords(file: string): StoreLoad | null {
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { records: [], errors: [`store file ${file} is not valid json: ${String(e)}`] };
  }
  const list = Array.isArray(parsed) ? parsed : ((parsed as { records?: unknown[] }).records ?? []);
  const records: BayRecord[] = [];
  const errors: string[] = [];
  for (const row of list) {
    const n = normalizeRecord(row);
    if (n.ok) records.push(n.record);
    else errors.push(n.error);
  }
  return { records, errors };
}

// committed curated seed, already normalized and deduped. a bad seed row is a
// programming error in committed data, so it fails loudly instead of quietly
// shrinking the bay.
export function seedRecords(type: StoreFileKey): BayRecord[] {
  const raw = type === "events" ? seedEventsJson : seedPlacesJson;
  const records: BayRecord[] = [];
  const errors: string[] = [];
  (raw as unknown[]).forEach((row, i) => {
    const n = normalizeRecord(row);
    if (n.ok) records.push(n.record);
    else errors.push(`seed ${type}[${i}]: ${n.error}`);
  });
  if (errors.length) throw new Error(`invalid seed data: ${errors.join("; ")}`);
  return mergeRecords([], records).records;
}

export function loadStore(dataDir: string, type: StoreFileKey): StoreLoad | null {
  return readRecords(storePath(dataDir, type));
}

export function saveStore(dataDir: string, type: StoreFileKey, records: BayRecord[]): string {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = storePath(dataDir, type);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ updatedAt: new Date().toISOString(), records }, null, "\t") + "\n");
  fs.renameSync(tmp, file);
  return file;
}

// the runtime store when it exists, the committed seed when it does not.
export function loadStoreOrSeed(
  dataDir: string,
  type: StoreFileKey,
): StoreLoad & { fromStore: boolean } {
  const loaded = loadStore(dataDir, type);
  if (loaded) return { ...loaded, fromStore: true };
  return { records: seedRecords(type), errors: [], fromStore: false };
}
