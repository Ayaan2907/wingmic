// packages/bay/src/ratelimit.ts
// per-identity sliding-window limiter with an optional daily cap. pure bookkeeping:
// callers bring the identity (clientIp below) and own the storage decision. the old
// implementation was in-memory and documented the trade ("one instance only; move to
// redis, keep the interface") - the interface is what ports here; the wingmic router
// can back it with the same store its api keys already use.
// ported from ayaan-site api/_ratelimit.js (1bca780): same window math, same fields.

export interface RateLimitRequest {
  headers: Record<string, unknown>;
  socket?: { remoteAddress?: string | null };
}

// the caller's ip, for per-ip limits. x-forwarded-for first hop wins; "unknown" is
// honest when nothing identifies the caller.
export function clientIp(req: RateLimitRequest): string {
  const fwd = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return fwd || (req.socket && req.socket.remoteAddress) || "unknown";
}

export interface Take {
  allowed: boolean;
  remaining: number;
}

// sliding window over in-window hits. count > perHour refuses without recording the
// hit: a refused request does not consume capacity.
export function limiter({
  perHour,
  windowMs = 60 * 60 * 1000,
  now = Date.now(),
}: {
  perHour: number;
  windowMs?: number;
  now?: number;
} = {}): { take: (t?: number) => Take; size: () => number } {
  const hits: number[] = [];
  const take = (t: number = Date.now()): Take => {
    const cutoff = t - windowMs;
    while (hits.length && hits[0] <= cutoff) hits.shift();
    if (hits.length >= perHour) return { allowed: false, remaining: 0 };
    hits.push(t);
    return { allowed: true, remaining: perHour - hits.length };
  };
  take(now);
  return { take, size: () => hits.length };
}

export interface DailyTake {
  allowed: boolean;
  used: number;
}

// daily cap keyed to the utc date; resets at midnight utc.
export function dailyCap(
  n: number,
  now: () => Date = () => new Date(),
): { take: () => DailyTake; used: () => number } {
  let day = now().toISOString().slice(0, 10);
  let used = 0;
  const take = (): DailyTake => {
    const today = now().toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      used = 0;
    }
    if (used >= n) return { allowed: false, used };
    used++;
    return { allowed: true, used };
  };
  return { take, used: () => used };
}
