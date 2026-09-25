// packages/bay/src/ratelimit.ts
// Per-ip sliding window, in memory. Good enough for one instance of a personal
// site. If this ever runs on more than one instance, move the buckets to redis
// and keep the interface. Ported byte-for-byte from ayaan-site api/_ratelimit.js
// (1bca780): same keys, same semantics, same refusal behavior.
// pure module: no env, no fetch, no log. the caller wires the request in.

export interface RatedRequest {
  headers: Record<string, unknown> | { get(name: string): string | null | undefined };
  socket?: { remoteAddress?: string | null } | null;
}

export function clientIp(req: { headers: Record<string, unknown>; socket?: { remoteAddress?: string | null } | null }): string {
  const raw = req.headers["x-forwarded-for"];
  const fwd = String(raw || "")
    .split(",")[0]
    .trim();
  return fwd || (req.socket && req.socket.remoteAddress) || "unknown";
}

// limiter({ perHour }) -> { take(ip) -> true if allowed, remaining(ip) }
export function limiter({
  perHour,
  windowMs = 3600e3,
  now = Date.now,
}: {
  perHour: number;
  windowMs?: number;
  now?: () => number;
}): {
  take(ip: string): boolean;
  remaining(ip: string): number;
  size(): number;
} {
  const hits = new Map<string, number[]>();
  const prune = (ip: string): number[] => {
    const t = now();
    const kept = (hits.get(ip) || []).filter((x) => t - x < windowMs);
    if (kept.length) hits.set(ip, kept);
    else hits.delete(ip);
    return kept;
  };
  return {
    take(ip) {
      const kept = prune(ip);
      if (kept.length >= perHour) return false;
      kept.push(now());
      hits.set(ip, kept);
      return true;
    },
    remaining(ip) {
      return Math.max(0, perHour - prune(ip).length);
    },
    size() {
      return hits.size;
    },
  };
}

// dailyCap(n) -> { take() -> true if under today's global cap }
export function dailyCap(
  n: number,
  now: () => Date = () => new Date(),
): { take(): boolean; used(): number } {
  let day = "";
  let count = 0;
  return {
    take() {
      const today = now().toISOString().slice(0, 10);
      if (today !== day) {
        day = today;
        count = 0;
      }
      if (count >= n) return false;
      count++;
      return true;
    },
    used() {
      return count;
    },
  };
}
