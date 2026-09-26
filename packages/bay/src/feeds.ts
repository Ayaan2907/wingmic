// packages/bay/src/feeds.ts
// organizer ICS/RSS feeds + direct submissions — the cheap rung of the source
// ladder. zero dependencies: ICS is parsed per RFC 5545's line grammar (unfold,
// BEGIN/END blocks, NAME;PARAM:VALUE), RSS per the RSS-Event module (ev:startdate).
// heterogeneous quality is expected: every item that fails the contract is a
// surfaced per-item error, never a failed source, and the seed covers the gaps.
//
// ids: ICS records key on the feed id + the VEVENT UID ("ics:<feedId>:<uid>",
// slug fallback when a feed omits UID); RSS items key "web:<feedId>:<slug>" —
// both stable per source, so a re-ingest lands on the same row.

import { normalizeRecord } from "./contract.js";
import { CANON } from "./personas.js";
import type { BayRecord, IngestSourceResult, RecordInput } from "./types.js";
import feedsJson from "./data/feeds.json";
import submissionsJson from "./data/submissions.json";

/* ---------- ics parsing ---------- */

// RFC 5545 3.1: a line beginning with a space or tab continues the previous one.
export function unfoldIcsLines(text: string): string[] {
  const unfolded: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if ((raw.startsWith(" ") || raw.startsWith("\t")) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += raw.slice(1);
    } else {
      unfolded.push(raw);
    }
  }
  return unfolded;
}

export interface IcsProperty {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** Parse one unfolded content line: NAME;PARAM=V;PARAM=V:the:value. The first
 * colon splits — property values may themselves contain colons. */
export function parseIcsLine(line: string): IcsProperty | null {
  const colon = line.indexOf(":");
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segments = head.split(";");
  const name = segments[0].trim().toUpperCase();
  if (!name) return null;
  const params: Record<string, string> = {};
  for (const segment of segments.slice(1)) {
    const eq = segment.indexOf("=");
    if (eq === -1) continue;
    params[segment.slice(0, eq).trim().toUpperCase()] = segment.slice(eq + 1).trim();
  }
  return { name, params, value };
}

export interface IcsVevent {
  uid?: string;
  summary?: string;
  location?: string;
  description?: string;
  url?: string;
  dtstart?: IcsProperty;
  dtend?: IcsProperty;
}

/** Collect VEVENT blocks from an unfolded calendar. Non-VEVENT lines are ignored
 * (a calendar's VTIMEZONE/VCALENDAR scaffolding is not an error). */
export function parseIcsVevents(text: string): { vevents: IcsVevent[]; errors: string[] } {
  const vevents: IcsVevent[] = [];
  const errors: string[] = [];
  let current: IcsVevent | null = null;
  for (const line of unfoldIcsLines(text)) {
    const prop = parseIcsLine(line);
    if (!prop) continue;
    if (prop.name === "BEGIN" && prop.value.trim().toUpperCase() === "VEVENT") {
      current = {};
      continue;
    }
    if (prop.name === "END" && prop.value.trim().toUpperCase() === "VEVENT") {
      if (current) vevents.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    switch (prop.name) {
      case "UID":
        current.uid = prop.value.trim();
        break;
      case "SUMMARY":
        current.summary = prop.value.trim();
        break;
      case "LOCATION":
        current.location = prop.value.trim();
        break;
      case "DESCRIPTION":
        current.description = prop.value.trim();
        break;
      case "URL":
        current.url = prop.value.trim();
        break;
      case "DTSTART":
        current.dtstart = prop;
        break;
      case "DTEND":
        current.dtend = prop;
        break;
      default:
        break; // allow-listed fields only — the rest of ICS is noise here
    }
  }
  if (current) errors.push("unterminated VEVENT (missing END:VEVENT)");
  return { vevents, errors };
}

/** Convert an ICS date/datetime value to a UTC ISO string. Handles Z-suffixed
 * UTC datetimes, all-day DATE values, and TZID/floating local times (converted
 * through the feed's declared timezone — an IANA name, via Intl). Null when the
 * value is not a parseable ICS date. */
export function icsDateToIso(value: string, tzid?: string): string | null {
  const v = value.trim();
  let m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(v);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])).toISOString();
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toISOString(); // all-day: midnight utc
  m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(v);
  if (m) return zonedToUtcIso(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], tzid);
  return null;
}

/** Minutes east of UTC at a given instant, for an IANA timezone name. */
function tzOffsetMs(instantMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = dtf.formatToParts(new Date(instantMs));
  const get = (type: string): number => +parts.find((p) => p.type === type)!.value;
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - instantMs;
}

// local wall-clock time in a zone -> utc instant. two passes so a DST boundary
// between the guess and the answer lands on the right side. an unknown IANA
// zone returns null — the record errors, the run continues.
function zonedToUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone?: string,
): string | null {
  const tz = timeZone || "America/Los_Angeles";
  try {
    Intl.DateTimeFormat("en-US", { timeZone }); // throws RangeError on an unknown zone
    const naive = Date.UTC(year, month, day, hour, minute, second);
    let instant = naive - tzOffsetMs(naive, tz);
    instant = naive - tzOffsetMs(instant, tz);
    return new Date(instant).toISOString();
  } catch {
    return null;
  }
}

/* ---------- feed config ---------- */

export interface FeedEntry {
  /** Feed-local id — namespaces record ids so two feeds never collide. */
  id: string;
  name: string;
  kind: "ics" | "rss";
  url: string;
  /** Record category (plural store vocabulary; singular folded via CANON). */
  category: string;
  /** IANA zone for floating/TZID-less local times (default America/Los_Angeles). */
  tz?: string;
}

export interface FeedConfig {
  feeds: FeedEntry[];
}

const FEED_KINDS = ["ics", "rss"] as const;

/** Validate the checked-in feed list: https urls, known kinds, canonical
 * categories. A bad config is an operator error — rejected loudly, not skipped
 * silently. */
export function parseFeedConfig(raw: unknown): { ok: true; config: FeedConfig } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "feed config is not an object" };
  const list = (raw as { feeds?: unknown }).feeds;
  if (!Array.isArray(list)) return { ok: false, error: "feed config needs a feeds array" };
  const feeds: FeedEntry[] = [];
  const seen = new Set<string>();
  for (const [i, entry] of list.entries()) {
    const e = (entry ?? {}) as Record<string, unknown>;
    const id = typeof e.id === "string" ? e.id.trim() : "";
    if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(id)) return { ok: false, error: `feeds[${i}]: id must be a short slug` };
    if (seen.has(id)) return { ok: false, error: `feeds[${i}]: duplicate id "${id}"` };
    seen.add(id);
    if (!FEED_KINDS.includes(e.kind as (typeof FEED_KINDS)[number])) {
      return { ok: false, error: `feeds[${i}] (${id}): kind must be ics or rss` };
    }
    const url = typeof e.url === "string" ? e.url.trim() : "";
    if (!/^https:\/\//.test(url)) return { ok: false, error: `feeds[${i}] (${id}): url must be https` };
    const category = typeof e.category === "string" ? CANON[e.category.trim()] : undefined;
    if (!category) return { ok: false, error: `feeds[${i}] (${id}): unknown category "${String(e.category)}"` };
    feeds.push({
      id,
      name: typeof e.name === "string" && e.name.trim() ? e.name.trim() : id,
      kind: e.kind as FeedEntry["kind"],
      url,
      category,
      ...(typeof e.tz === "string" && e.tz.trim() ? { tz: e.tz.trim() } : {}),
    });
  }
  return { ok: true, config: { feeds } };
}

/** The checked-in curated list. A broken checked-in config is a programming
 * error in committed data — it fails loudly, like a bad seed row. */
export function defaultFeedConfig(): FeedConfig {
  const parsed = parseFeedConfig(feedsJson);
  if (!parsed.ok) throw new Error(`invalid checked-in feeds.json: ${parsed.error}`);
  return parsed.config;
}

/* ---------- record mapping ---------- */

const slugFor = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

// one vevent -> a raw contract input. fails with a message when the event has no
// parseable DTSTART (normalizeRecord requires startsAt for events).
export function icsVeventToRecordInput(
  vevent: IcsVevent,
  feed: FeedEntry,
  now: string,
): { ok: true; input: RecordInput } | { ok: false; error: string } {
  const startsAt = vevent.dtstart ? icsDateToIso(vevent.dtstart.value, vevent.dtstart.params.TZID || feed.tz) : null;
  if (!startsAt) return { ok: false, error: `no parseable DTSTART (uid "${vevent.uid || "?"}")` };
  const endsAt = vevent.dtend ? icsDateToIso(vevent.dtend.value, vevent.dtend.params.TZID || feed.tz) : undefined;
  const uidPart = vevent.uid ? slugFor(vevent.uid) : slugFor(vevent.summary || "");
  if (!uidPart) return { ok: false, error: `no UID or SUMMARY to key an id (feed "${feed.id}")` };
  return {
    ok: true,
    input: {
      id: `ics:${feed.id}:${uidPart}`,
      type: "event",
      category: feed.category,
      title: vevent.summary || "untitled event",
      source: "ics",
      venue: vevent.location,
      note: vevent.description,
      url: vevent.url,
      startsAt,
      endsAt,
      fetchedAt: now,
      firstSeenAt: now,
    },
  };
}

// all-day DTEND is exclusive per RFC 5545; the contract keeps the declared
// endsAt and expiry math runs on it as written.

/* ---------- rss parsing ---------- */

const entityMap: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
};
const decodeXml = (s: string): string => s.replace(/&(amp|lt|gt|quot|apos|#39);/g, (all) => entityMap[all] ?? all);
const stripCdata = (s: string): string => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");

const tagText = (block: string, tag: string): string | undefined => {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(block);
  if (!m) return undefined;
  return decodeXml(stripCdata(m[1])).trim() || undefined;
};

export interface RssItem {
  title?: string;
  link?: string;
  description?: string;
  /** RSS-Event module date (ev:startdate / ev:enddate, any namespace prefix). */
  startDate?: string;
  endDate?: string;
}

/** Parse an RSS 2.0 feed's items. Event dates come only from the RSS-Event
 * module (purl.org/rss/1.0/modules/event/) — pubDate is when the item was
 * published, not when the event happens, and is never used as startsAt. */
export function parseRssItems(text: string): { items: RssItem[]; errors: string[] } {
  const items: RssItem[] = [];
  const errors: string[] = [];
  const blocks = text.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  if (blocks.length === 0 && !/<rss\b/i.test(text)) {
    return { items, errors: ["response does not look like an rss feed"] };
  }
  for (const [i, block] of blocks.entries()) {
    const title = tagText(block, "title");
    const startDate = tagText(block, "(?:[a-z0-9]+:)?startdate");
    // date-less items are announcements, not events — say so and move on
    if (!startDate) {
      errors.push(`rss item ${i}${title ? ` (${title})` : ""}: no event module startdate`);
      continue;
    }
    items.push({
      title,
      link: tagText(block, "link"),
      description: tagText(block, "description"),
      startDate,
      endDate: tagText(block, "(?:[a-z0-9]+:)?enddate"),
    });
  }
  return { items, errors };
}

// event-module dates arrive in the wild as iso-with-offset, space-separated, or
// ics-compact. parse in that order; anything else is an error, never a guess.
function rssDateToIso(value: string, tz?: string): string | null {
  const v = value.trim();
  if (/^\d{8}/.test(v)) return icsDateToIso(v, tz); // ics-compact habit
  const spaced = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(v) ? v.replace(" ", "T") : v;
  if (Number.isFinite(Date.parse(spaced))) return new Date(Date.parse(spaced)).toISOString();
  return null;
}

export function rssItemToRecordInput(
  item: RssItem,
  feed: FeedEntry,
  now: string,
): { ok: true; input: RecordInput } | { ok: false; error: string } {
  const startsAt = rssDateToIso(item.startDate!, feed.tz);
  if (!startsAt) return { ok: false, error: `unparseable event startdate "${item.startDate}"` };
  const endsAt = item.endDate ? (rssDateToIso(item.endDate, feed.tz) ?? undefined) : undefined;
  const slug = slugFor(item.title || item.link || "");
  if (!slug) return { ok: false, error: `rss item has no title or link to key an id (feed "${feed.id}")` };
  return {
    ok: true,
    input: {
      id: `web:${feed.id}:${slug}`,
      type: "event",
      category: feed.category,
      title: item.title || "untitled event",
      source: "web",
      url: item.link,
      note: item.description,
      startsAt,
      endsAt,
      fetchedAt: now,
      firstSeenAt: now,
    },
  };
}

/* ---------- the feeds source ---------- */

async function getFeedText(url: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<string> {
  const res = await fetchImpl(url, {
    headers: { accept: "text/calendar, application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`feed http ${res.status}`);
  return res.text();
}

function recordsFromItems(
  feed: FeedEntry,
  inputs: ({ ok: true; input: RecordInput } | { ok: false; error: string })[],
  now: string,
): { records: BayRecord[]; errors: string[] } {
  const records: BayRecord[] = [];
  const errors: string[] = [];
  for (const r of inputs) {
    if (!r.ok) {
      errors.push(`${feed.id}: ${r.error}`);
      continue;
    }
    const n = normalizeRecord(r.input, { now });
    if (n.ok) records.push(n.record);
    else errors.push(`${feed.id}: ${n.error}`);
  }
  return { records, errors };
}

export interface FeedsSourceOptions {
  config?: FeedConfig;
  fetchImpl?: typeof fetch;
  fetchTimeoutMs?: number;
  now?: string;
}

/** One feed-list source: every configured ICS/RSS feed, per-feed error isolation
 * (a down feed contributes an error line, never a failed run). */
export async function feedsSource({
  config = defaultFeedConfig(),
  fetchImpl = fetch,
  fetchTimeoutMs = 15_000,
  now = new Date().toISOString(),
}: FeedsSourceOptions = {}): Promise<IngestSourceResult> {
  const out: IngestSourceResult = { name: "feeds", records: [], errors: [] };
  for (const feed of config.feeds) {
    let text: string;
    try {
      text = await getFeedText(feed.url, fetchImpl, fetchTimeoutMs);
    } catch (e) {
      out.errors.push(`${feed.id}: ${(e as Error).message}`);
      continue;
    }
    if (feed.kind === "ics") {
      const { vevents, errors } = parseIcsVevents(text);
      const mapped = recordsFromItems(feed, vevents.map((v) => icsVeventToRecordInput(v, feed, now)), now);
      out.records.push(...mapped.records);
      out.errors.push(...errors.map((e) => `${feed.id}: ${e}`), ...mapped.errors);
      continue;
    }
    const { items, errors } = parseRssItems(text);
    const mapped = recordsFromItems(feed, items.map((it) => rssItemToRecordInput(it, feed, now)), now);
    out.records.push(...mapped.records);
    out.errors.push(...errors.map((e) => `${feed.id}: ${e}`), ...mapped.errors);
  }
  return out;
}

/* ---------- submissions ---------- */

// direct submissions: operator-curated raw records, checked into the repo.
// source is forced to "submitted" — a submission cannot borrow a live-source
// label. normalizeRecord ids them "submitted:<slug(title)>" when no id is given,
// which keeps re-submission idempotent.
export function submissionsSource(rawRecords: unknown[] = submissionsJson as unknown[]): IngestSourceResult {
  const out: IngestSourceResult = { name: "submissions", records: [], errors: [] };
  for (const [i, raw] of rawRecords.entries()) {
    const input = { ...(raw as RecordInput), source: "submitted" };
    const n = normalizeRecord(input);
    if (n.ok) out.records.push(n.record);
    else out.errors.push(`submissions[${i}]: ${n.error}`);
  }
  return out;
}
