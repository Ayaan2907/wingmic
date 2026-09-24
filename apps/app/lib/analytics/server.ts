/**
 * Server-side PostHog capture (posthog-node).
 *
 * Init is a no-op unless POSTHOG_KEY (or NEXT_PUBLIC_POSTHOG_KEY as a
 * fallback) is set — local dev and tests stay completely silent, matching
 * the repo's zero-secrets boot contract. `trackAnalyticsEvent` is
 * fire-and-forget: analytics must never block or fail a product path (spec
 * capture invariant: enrichment/assistant work is asynchronous), so capture
 * failures are logged, never thrown.
 *
 * PII policy (spec + orchestrator contract): distinctId is the opaque
 * BetterAuth user id — never the email. No emails, names, or message/
 * transcript content in event properties or person properties. We never
 * call `identify`/personization at all; `sanitizeAnalyticsProperties` is the
 * structural backstop for future call sites.
 */
import { PostHog } from 'posthog-node';
import { env } from '@/lib/config/env';
import type { AnalyticsEventName } from './events';

const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';
/** Bounded event size: at most this many properties per event. */
const MAX_PROPERTIES = 12;
/** Strings are truncated, not dropped — route/scope/method stay useful. */
const MAX_STRING_LENGTH = 64;

export type AnalyticsPropertyValue = string | number | boolean;
export type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;

let client: PostHog | null = null;
/** Key the cached client was built with — rebuild if the key changes (tests). */
let clientKey: string | null = null;

function analyticsKey(): string | null {
  return env.POSTHOG_KEY ?? env.NEXT_PUBLIC_POSTHOG_KEY ?? null;
}

/** Lazily construct the singleton client; null when analytics is disabled. */
function analyticsClient(): PostHog | null {
  const key = analyticsKey();
  if (!key) return null;
  if (!client || clientKey !== key) {
    client = new PostHog(key, {
      host: env.POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST,
    });
    clientKey = key;
  }
  return client;
}

/**
 * Pure backstop enforcing the bounded-property contract: primitives only,
 * at most MAX_PROPERTIES entries, strings truncated to MAX_STRING_LENGTH,
 * non-finite numbers and empty strings dropped. Bounded inputs keep event
 * sizes and cardinality predictable — and make it structurally hard to leak
 * transcripts or contact details through a property bag.
 */
export function sanitizeAnalyticsProperties(
  properties: AnalyticsProperties | undefined,
): Record<string, AnalyticsPropertyValue> | undefined {
  if (!properties) return undefined;
  const out: Record<string, AnalyticsPropertyValue> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (Object.keys(out).length >= MAX_PROPERTIES) break;
    if (typeof value === 'boolean') {
      out[key] = value;
    } else if (typeof value === 'number') {
      if (Number.isFinite(value)) out[key] = value;
    } else if (typeof value === 'string') {
      const trimmed = value.trim().slice(0, MAX_STRING_LENGTH);
      if (trimmed.length > 0) out[key] = trimmed;
    }
    // anything else (undefined, null, objects, arrays): dropped
  }
  return out;
}

/**
 * Fire-and-forget capture. Never throws and never awaits — call sites must
 * not treat this as a synchronization point. No-op when no key is configured.
 */
export function trackAnalyticsEvent(
  distinctId: string,
  event: AnalyticsEventName,
  properties?: AnalyticsProperties,
): void {
  try {
    const ph = analyticsClient();
    if (!ph) return;
    if (!distinctId) return;
    ph.capture({
      distinctId,
      event,
      properties: sanitizeAnalyticsProperties(properties),
    });
  } catch (err) {
    // Surfaced, not silent: analytics failure never breaks the product path.
    console.error('[analytics] capture failed:', event, err);
  }
}
