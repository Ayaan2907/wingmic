// pins from tests/ratelimit.test.mjs (3 tests), ported faithfully: the per-ip
// window trips and forgets, the daily cap resets at the utc date, and the first
// x-forwarded-for hop wins.
import { describe, expect, it } from "vitest";

import { clientIp, dailyCap, limiter } from "./ratelimit.js";

describe("limiter", () => {
  it("allows perHour hits then refuses, and forgets after the window", () => {
    let t = 0;
    const l = limiter({ perHour: 2, windowMs: 100, now: () => t });
    expect(l.take("a")).toBe(true);
    expect(l.take("a")).toBe(true);
    expect(l.take("a")).toBe(false);
    expect(l.take("b")).toBe(true); // other ips are independent
    t = 150;
    expect(l.take("a")).toBe(true);
    expect(l.remaining("a")).toBe(1);
  });
});

describe("dailyCap", () => {
  it("resets when the date changes", () => {
    let d = new Date("2026-09-08T10:00:00Z");
    const c = dailyCap(1, () => d);
    expect(c.take()).toBe(true);
    expect(c.take()).toBe(false);
    d = new Date("2026-09-09T00:00:01Z");
    expect(c.take()).toBe(true);
  });
});

describe("clientIp", () => {
  it("prefers the first x-forwarded-for hop", () => {
    expect(
      clientIp({ headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } }),
    ).toBe("1.2.3.4");
    expect(clientIp({ headers: {}, socket: { remoteAddress: "127.0.0.1" } })).toBe("127.0.0.1");
  });
});
