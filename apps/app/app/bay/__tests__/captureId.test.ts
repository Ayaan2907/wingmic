// @vitest-environment node
// apps/app/app/bay/__tests__/captureId.test.ts — the claim button's
// idempotency key. The browser derives it with WebCrypto; the server derives
// the same value from the same text (lib/bay/wingmic.ts bayClaimCaptureId).
// These pins run on node:crypto so the two derivations can never drift.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { profileCaptureId } from '../captureId';

const PASTE = 'sam rivera — ml engineer at a small robotics lab. into drones, mapping, and evals.';

const nodeSha16 = (text: string): string =>
  createHash('sha256').update(text).digest('hex').slice(0, 16);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('profileCaptureId', () => {
  it('derives the same id the server derives for a pasted profile', async () => {
    await expect(profileCaptureId({ text: PASTE })).resolves.toBe(`bay-claim-${nodeSha16(PASTE)}`);
  });

  it('is stable across calls and distinct per profile', async () => {
    const first = await profileCaptureId({ text: PASTE });
    const second = await profileCaptureId({ text: PASTE });
    const other = await profileCaptureId({ text: 'someone else entirely' });
    expect(second).toBe(first);
    expect(other).toMatch(/^bay-claim-[0-9a-f]{16}$/);
    expect(other).not.toBe(first);
  });

  it('hashes a canonical serialization for structured-only profiles', async () => {
    const id = await profileCaptureId({ name: 'sam rivera', topics: ['drones'] });
    expect(id).toMatch(/^bay-claim-[0-9a-f]{16}$/);
    // key order in the held object must not change the id
    await expect(profileCaptureId({ topics: ['drones'], name: 'sam rivera' })).resolves.toBe(id);
  });

  it('returns null when WebCrypto is unavailable — the claim omits the id and the router derives it', async () => {
    vi.stubGlobal('crypto', {} as typeof crypto);
    await expect(profileCaptureId({ text: PASTE })).resolves.toBeNull();
  });

  it('agrees with node sha256 when running against the real WebCrypto implementation', async () => {
    // the shape of the guard: the browser path uses the same algorithm the
    // fixtures' node derivation assumes (the e2e seeds the dedupe row with it)
    vi.stubGlobal('crypto', webcrypto);
    await expect(profileCaptureId({ text: PASTE })).resolves.toBe(`bay-claim-${nodeSha16(PASTE)}`);
  });
});
