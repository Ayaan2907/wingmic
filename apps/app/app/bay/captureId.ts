// apps/app/app/bay/captureId.ts — the claim button's idempotency key, computed
// from the browser-held profile (locked decision 3). The same derivation the
// router applies server-side (lib/bay/wingmic.ts bayClaimCaptureId): sha256 of
// the profile text, first 16 hex chars, prefixed "bay-claim-". Passing it
// explicitly makes a double-clicked claim and a retry after a network error
// land on one capture — the server dedupes on it either way.

import type { ClientProfile } from './clientProfile';

/** Text the id is derived from: the raw paste when there is one (the same
 * string the server's pipeline keeps as profile.raw), else a stable
 * serialization of the structured fields. */
function claimTextOf(profile: ClientProfile): string {
  if (profile.text && profile.text.trim()) return profile.text;
  return JSON.stringify(profile, Object.keys(profile).sort());
}

/** The stable capture id for a browser-held profile, or null when this
 * context has no WebCrypto (non-secure contexts): the claim then omits the id
 * and the router derives the same value server-side — idempotency never
 * depends on the client computing it. */
export async function profileCaptureId(profile: ClientProfile): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const bytes = new TextEncoder().encode(claimTextOf(profile));
  const digest = await subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `bay-claim-${hex.slice(0, 16)}`;
}
