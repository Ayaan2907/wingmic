// sources pins: one interface, the six-rung ladder, and the behaviors the job
// depends on — recorded fixtures per source (luma discover, meetup graphql,
// an ICS calendar, an RSS feed), meetup's graceful absence (locked decision 4),
// the point budget's error path, normalizer rejections, and the exit-code
// convention (non-zero only when every attempted source failed). fetch is
// injected — no network in tests.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  MeetupRateBudgetError,
  PointBudget,
  fetchMeetupToken,
  meetupNodeToRecordInput,
  meetupSource,
} from "./meetup.js";
import { parseFeedConfig, feedsSource, submissionsSource } from "./feeds.js";
import { baySources, ingestExitCode, makeLumaSource, makeMeetupSource } from "./sources.js";
import type { IngestSourceResult } from "./types.js";

const NOW = "2026-02-01T12:00:00.000Z";
const fixture = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

const okJson = (body: unknown, url: RequestInfo | URL): Response => {
  void url;
  return new Response(JSON.stringify(body), { status: 200 });
};

describe("baySources registry", () => {
  it("returns the six-rung ladder in spec order", () => {
    expect(baySources().map((s) => s.name)).toEqual([
      "seed",
      "luma",
      "meetup",
      "feeds",
      "submissions",
      "eventbrite",
    ]);
  });

  it("creates a meetup source that skips cleanly when credentials are absent", async () => {
    const source = makeMeetupSource({ credentials: null });
    const result = await source.fetch({ now: NOW, fetchImpl: fetch, fetchTimeoutMs: 1000 });
    expect(result.name).toBe("meetup");
    expect(result.records).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.skipped).toMatch(/MEETUP_CLIENT_ID/);
  });
});

describe("luma source (recorded fixture)", () => {
  it("maps the discover fixture into raw records, coords kept only when shared", async () => {
    const payload = JSON.parse(fixture("luma-discover.json"));
    const source = makeLumaSource({ cities: ["sf"] });
    const result = await source.fetch({
      now: NOW,
      fetchImpl: async (url) => okJson(payload, url),
      fetchTimeoutMs: 1000,
    });
    expect(result.errors).toEqual([]);
    expect(result.records.map((r) => r.id)).toEqual(["luma:fix-luma-001", "luma:fix-luma-002"]);
    expect(result.records[0].category).toBe("hackathons");
    expect(result.records[0].lat).toBe(37.7749);
    expect(result.records[1].lat).toBeUndefined();
    expect(result.records[1].category).toBe("events");
  });
});

describe("meetup source (recorded fixtures)", () => {
  const creds = { clientId: "fixture-id", clientSecret: "fixture-secret" };

  it("exchanges the token, then maps eventsSearch nodes", async () => {
    const token = JSON.parse(fixture("meetup-token.json"));
    const events = JSON.parse(fixture("meetup-events.json"));
    const urls: string[] = [];
    const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
      urls.push(String(url));
      const isToken = String(url).includes("oauth2");
      return new Response(JSON.stringify(isToken ? token : events), { status: 200 });
    }) as typeof fetch;

    const result = await meetupSource({ credentials: creds, fetchImpl, now: NOW });
    expect(result.errors).toEqual([]);
    expect(result.records.map((r) => r.id)).toEqual(["meetup:fix-meetup-001", "meetup:fix-meetup-002"]);
    // token posted to the oauth endpoint first, then the graphql endpoint with the bearer
    expect(urls[0]).toMatch(/oauth2\/access$/);
    expect(urls[1]).toMatch(/api\.meetup\.com\/gql2$/);
    expect(result.records[0].source).toBe("meetup");
    expect(result.records[0].venue).toBe("The Foundry");
  });

  it("honors an operator-minted access token without the token exchange", async () => {
    const events = JSON.parse(fixture("meetup-events.json"));
    const fetchImpl = (async (url: RequestInfo | URL) => {
      void url;
      return new Response(JSON.stringify(events), { status: 200 });
    }) as typeof fetch;
    const result = await meetupSource({ credentials: { ...creds, accessToken: "minted" }, fetchImpl, now: NOW });
    expect(result.errors).toEqual([]);
    expect(result.records.length).toBe(2);
  });

  it("rejects nodes the contract cannot normalize, per-item", () => {
    const bad = meetupNodeToRecordInput({ id: "x" }, NOW); // no title
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/id or title/);
  });

  it("turns an exhausted point budget into an error line, never a crash", async () => {
    // a page that keeps paging: page 2's spend trips the budget after page 1
    // spent it
    const paged = {
      data: {
        eventsSearch: {
          totalCount: 2,
          pageInfo: { hasNextPage: true, endCursor: "c1" },
          edges: JSON.parse(fixture("meetup-events.json")).data.eventsSearch.edges,
        },
      },
    };
    const budget = new PointBudget({
      limit: 25, // one page's worth; the second spend must trip the budget
      maxWaitMs: 0,
      now: () => 1000,
      sleep: async () => {},
    });
    const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
      void init;
      if (String(url).includes("oauth2")) return okJson({ access_token: "t" }, url);
      return okJson(paged, url);
    }) as typeof fetch;

    const result = await meetupSource({
      credentials: { ...creds, accessToken: "minted" },
      fetchImpl,
      budget,
      maxPages: 2,
      now: NOW,
    });
    // page 1 spent the whole budget; page 2's spend throws and lands as an error
    expect(result.records.length).toBe(2); // page 1 records survive
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toMatch(/point budget/);
  });

  it("prunes an all-stale window without crashing (the recovery path)", async () => {
    // every entry stale at prune time was the crash: the reverse loop spliced
    // the array empty on its first iteration, then indexed the hole
    let clock = 1_000;
    const budget = new PointBudget({ limit: 30, windowMs: 60_000, now: () => clock });
    await budget.spend(10);
    await budget.spend(10); // two chronological entries
    clock = 61_000; // jump: every entry now stale when the next spend prunes
    await expect(budget.spend(1)).resolves.toBeUndefined();
  });

  it("recovers by waiting when the window rolls", async () => {
    // the successful-wait path: sleep advances the injected clock past the
    // window, the prune empties it harmlessly, and the spend lands
    let clock = 1_000;
    const budget = new PointBudget({
      limit: 25,
      windowMs: 60_000,
      maxWaitMs: 120_000,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
    });
    await budget.spend(25); // full at t=1000
    await expect(budget.spend(1)).resolves.toBeUndefined(); // wait rolls the window, then succeeds
    // the wait is exact: it wakes at oldest + windowMs, the first instant the
    // budget frees — not a tick later
    expect(clock).toBe(61_000);
  });

  it("surfaces graphql-level errors as error lines", async () => {
    const fetchImpl = (async (url: RequestInfo | URL) => {
      if (String(url).includes("oauth2")) return okJson({ access_token: "t" }, url);
      return okJson({ errors: [{ message: "contributing to too many groups" }] }, url);
    }) as typeof fetch;
    const result = await meetupSource({ credentials: { ...creds, accessToken: "minted" }, fetchImpl, now: NOW });
    expect(result.records).toEqual([]);
    expect(result.errors[0]).toMatch(/graphql/);
  });

  it("records a token failure as an error without throwing", async () => {
    const fetchImpl = (async () => new Response("nope", { status: 403 })) as typeof fetch;
    await expect(fetchMeetupToken(creds, fetchImpl, 100)).rejects.toThrow(/403/);
    const result = await meetupSource({ credentials: creds, fetchImpl, now: NOW });
    expect(result.records).toEqual([]);
    expect(result.errors[0]).toMatch(/token/);
  });
});

describe("feeds source (recorded ICS/RSS fixtures)", () => {
  const config = {
    feeds: [
      { id: "fixture-cal", name: "fixture calendar", kind: "ics" as const, url: "https://cal.example.org/feed.ics", category: "events", tz: "America/Los_Angeles" },
      { id: "fixture-rss", name: "fixture rss", kind: "rss" as const, url: "https://feeds.example.org/feed.rss", category: "events" },
    ],
  };

  it("parses the ICS fixture: TZID conversion, folding, per-item rejections", async () => {
    const ics = fixture("bay-calendar.ics");
    const fetchImpl = (async (url: RequestInfo | URL) => {
      void url;
      return new Response(ics, { status: 200 });
    }) as typeof fetch;
    const result = await feedsSource({ config, fetchImpl, now: NOW });
    const event = result.records.find((r) => r.id === "ics:fixture-cal:evt-001-bay-example");
    expect(event).toBeTruthy();
    // TZID=America/Los_Angeles 18:00 → 02:00 UTC next day (PST in february)
    expect(event?.startsAt).toBe("2026-02-11T02:00:00.000Z");
    expect(event?.venue).toBe("650 California St, San Francisco");
    // the folded description line continues the first — the join is visible
    expect(event?.note).toMatch(/folded-line fixture: this sentence continues/);
    // the date-less VEVENT is a per-item rejection, not a failed source
    expect(result.errors.some((e) => e.includes("no parseable DTSTART"))).toBe(true);
    // a quoted TZID (RFC 5545 allows quoted param-values) resolves identically
    // to the unquoted one — same wall time, same instant
    const quoted = result.records.find((r) => r.id === "ics:fixture-cal:evt-003-bay-example");
    expect(quoted).toBeTruthy();
    expect(quoted?.startsAt).toBe("2026-02-11T02:00:00.000Z");
  });

  it("parses the RSS fixture: event-module dates, announcement items rejected", async () => {
    const rss = fixture("bay-events.rss");
    const fetchImpl = (async (url: RequestInfo | URL) => {
      void url;
      return new Response(rss, { status: 200 });
    }) as typeof fetch;
    const rssConfig = { feeds: [config.feeds[1]] };
    const result = await feedsSource({ config: rssConfig, fetchImpl, now: NOW });
    expect(result.records.map((r) => r.id)).toEqual(["web:fixture-rss:founders-coffee"]);
    expect(result.records[0].startsAt).toBe("2026-02-11T17:00:00.000Z");
    expect(result.errors.some((e) => e.includes("no event module startdate"))).toBe(true);
  });

  it("isolates a down feed while the others still land", async () => {
    const rss = fixture("bay-events.rss");
    const fetchImpl = (async (url: RequestInfo | URL) => {
      if (String(url).endsWith(".ics")) throw new Error("feed http 503");
      return new Response(rss, { status: 200 });
    }) as typeof fetch;
    const result = await feedsSource({ config, fetchImpl, now: NOW });
    expect(result.errors.some((e) => e.includes("fixture-cal: feed http 503"))).toBe(true);
    expect(result.records.map((r) => r.id)).toEqual(["web:fixture-rss:founders-coffee"]);
  });

  it("rejects a bad checked-in feed config loudly", () => {
    expect(parseFeedConfig({ feeds: [{ id: "x", kind: "gopher", url: "https://x", category: "events" }] }).ok).toBe(false);
    expect(parseFeedConfig({ feeds: [{ id: "x", kind: "ics", url: "http://x", category: "events" }] }).ok).toBe(false);
    expect(parseFeedConfig({ feeds: [{ id: "x", kind: "ics", url: "https://x", category: "nonsense" }] }).ok).toBe(false);
  });
});

describe("submissions + eventbrite", () => {
  it("forces the submitted source label and rejects bad rows per-item", () => {
    const records = [
      { id: "sub:demo-night", type: "event", title: "demo night", category: "events", url: "https://x.example/e", startsAt: "2026-02-20T18:00:00Z", source: "luma" },
      // the core contract validates url format when present — a non-https url
      // is a per-row rejection, not a failed source
      { id: "sub:bad", type: "event", title: "insecure url", category: "events", url: "http://x.example/e", startsAt: "2026-02-20T18:00:00Z", source: "web" },
    ];
    const result = submissionsSource(records);
    expect(result.records[0].source).toBe("submitted");
    expect(result.errors[0]).toMatch(/submissions\[1\]/);
  });

  it("keeps eventbrite a documented stub", async () => {
    const source = baySources().find((s) => s.name === "eventbrite")!;
    const result = await source.fetch({ now: NOW, fetchImpl: fetch, fetchTimeoutMs: 1000 });
    expect(result.skipped).toMatch(/eventbrite/i);
  });
});

describe("ingestExitCode", () => {
  const failed = (name: string): IngestSourceResult => ({ name, records: [], errors: [`${name} down`] });

  it("exits non-zero only when every attempted source failed", () => {
    expect(ingestExitCode([failed("luma"), failed("meetup")])).toBe(1);
    expect(ingestExitCode([failed("luma"), { name: "seed", records: [], errors: [] }])).toBe(0);
    expect(ingestExitCode([])).toBe(0);
  });

  it("treats skipped sources as neither attempted nor failed", () => {
    const skipped = { name: "meetup", records: [], errors: [], skipped: "no credentials" };
    expect(ingestExitCode([skipped])).toBe(0); // all-skip run: summary, exit 0
    expect(ingestExitCode([skipped, failed("luma")])).toBe(1); // the only attempted source failed
  });

  it("never throws MeetupRateBudgetError from the exit-code path", () => {
    // the budget error surfaces as an error LINE on the source result, so a
    // budget-exhausted meetup alone is a failed run by convention
    expect(() => ingestExitCode([failed("meetup")])).not.toThrow();
    expect(MeetupRateBudgetError).toBeDefined();
  });
});
