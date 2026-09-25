// pins from tests/ratelimit.test.mjs (3 tests): the window trips, the ip resolution,
// and the slide.
import { describe, expect, it } from "vitest";

import { clientIp, dailyCap, limiter } from "./ratelimit.js";

describe("limiter", () => {
  it("allows up to the per-hour count, then refuses without consuming", () => {
    let l = limiter({ perHour: 2, now: 1_000_000 });
    expect(l.take().allowed).toBe(true);
    expect(l.take().allowed).toBe(true);
    const refused = l.take();
    expect(refused.allowed).toBe(false);
    expect(refused.remaining).toBe(0);
    expect(l.size()).toBe(2); // the refused hit was not recorded
  });

  it("slides the window as hits age out", () => {
    let l = limiter({ perHour: 2, now: 1_000_000 });
    l.take(1_000_000);
    l.take(1_000_001);
    expect(l.take(1_000_002).allowed).toBe(false);
    // one hour later, capacity is back
    expect(l.take(1_000_000 + 3_600_000 + 1).allowed).toBe(true);
    expect(l.size()).toBe(1);
  });
});

describe("clientIp", () => {
  it("prefers the first x-forwarded-for hop and is honest when unknown", () => {
    expect(clientIp({ headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } })).toBe("1.2.3.4");
    expect(clientIp({ headers: {}, socket: { remoteAddress: "127.0.0.1" } })).toBe("127.0.0.1");
    expect(clientIp({ headers: {} })).toBe("unknown");
  });
});

describe("dailyCap", () => {
  it("counts per utc day and resets at midnight", () => {
    const base = new Date("2026-01-09T23:59:00.000Z");
    let t = base.getTime();
    const cap = dailyCap(1, () => new Date(t));
    expect(cap.take().allowed).toBe(true);
    expect(cap.take().allowed).toBe(false);
    t += 61_000; // cross midnight utc
    expect(cap.take().allowed).toBe(true);
  });
});
