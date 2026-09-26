import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { BayRecord, Meet, VerifyResult, ViewerProfile, WingmicClient } from '@wingmic/bay';
import { WingmicAuthError } from '@wingmic/bay';
import * as schema from '@wingmic/db/schema';
import { apiCallerContext } from '@/lib/api/server';
import type { TRPCContext } from '@/lib/trpc/context';
import { captureRouter } from '@/lib/trpc/routers/capture';
import { recallRouter } from '@/lib/trpc/routers/recall';

type Db = TRPCContext['db'];

/**
 * The scope vocabulary, carried as intent (locked decision 5): the old wk_live_
 * keys enforced these at the HTTP edge; inside one app they are the boundary's
 * own contract — network reads are search-shaped, writes are capture-shaped.
 */
export const BAY_SCOPES = { read: 'search:read', write: 'capture:write' } as const;

/**
 * The internal service boundary — locked decision 5: the shape of ayaan-site's
 * `_wingmic.js` client (getProfile / networkOverlap / verify / capture), now
 * backed by the app's own graph + recall services instead of REST v1 keys.
 *
 * What the merge changed, on purpose:
 *   - the credential is gone. The interface's token slot survives for shape
 *     fidelity and must carry the session-resolved userId — the same value the
 *     router passes as `wingmicToken`, never client input (the rule the
 *     events router pins). Any other value throws WingmicAuthError: the old
 *     dead-key 401, now guarding the boundary from caller-chosen tokens.
 *   - selfProfile is true — inside the app the boundary CAN read the viewer's
 *     own profile (today: the user row; enrichment fills roles/topics later).
 *   - capture goes through capture.commit — the same internal procedure the
 *     chat surface and REST v1 use, so extraction, clientCaptureId
 *     idempotency, and provenance stay in one place.
 *
 * Degradation rule, unchanged from the old client: graph trouble degrades to
 * [] — a score never fails because the network read did. Credential checks
 * throw WingmicAuthError (overlapSafely rethrows it; verify reports it as
 * ok:false), so a caller identity that does not match the session surfaces
 * instead of silently scoring against someone else's graph.
 */
export class WingmicUserService implements WingmicClient {
  readonly label = 'graph';
  readonly selfProfile = true;

  constructor(
    private readonly db: Db,
    private readonly userId: string,
    private readonly headers: Headers = new Headers(),
  ) {}

  /** The signed-in viewer's profile (scope intent: BAY_SCOPES.read). The graph
   * does not model the user's own roles/topics yet — enrichment owns that —
   * so today this is the user row only, honestly thin: qualityOf reports
   * 'thin' and scoring leans on networkOverlap plus the ask path. */
  async getProfile(): Promise<ViewerProfile | null> {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, this.userId),
      columns: { id: true, name: true },
    });
    if (!user) return null;
    return {
      kind: 'wingmic',
      name: user.name ?? undefined,
      headline: undefined,
      roles: [],
      topics: [],
      goals: [],
      links: {},
    };
  }

  /** People from the viewer's own network connected to the event's world
   * (scope intent: BAY_SCOPES.read). Reuses the recall router — the same
   * ranked service /search serves — via the repo's createCaller pattern. */
  async networkOverlap(token: string, ctx: { event: BayRecord; k?: number }): Promise<Meet[]> {
    if (token !== this.userId) throw new WingmicAuthError();
    const k = Math.max(1, Math.min(ctx.k ?? 3, 3));
    const q = [ctx.event.title, ctx.event.category, ctx.event.venue, ctx.event.note]
      .filter(Boolean)
      .join(' ')
      .slice(0, 500);
    try {
      const caller = recallRouter.createCaller(apiCallerContext(this.userId, this.headers));
      const res = await caller.query({ q, limit: k });
      return res.entities.slice(0, k).map((e) => {
        const bits = [...e.companies.map((c) => c.name), ...e.topics.map((t) => t.name)]
          .filter(Boolean)
          .slice(0, 3);
        return {
          who: e.name.slice(0, 120) || 'someone from your network',
          why: bits.length
            ? `moves in the ${bits.join(', ').slice(0, 200)} circle`
            : 'in your network',
          starter: null, // the explain stage writes starters when it has context
        };
      });
    } catch (e) {
      if (e instanceof WingmicAuthError) throw e;
      // graph or recall outage: the score rides on without the network — never a 500
      console.warn('[bay] networkOverlap degraded:', e instanceof Error ? e.message : e);
      return [];
    }
  }

  /** One probe that tells a live viewer from a gone one. A session user exists
   * by construction; this answers { ok: true } unless the user row is gone. */
  async verify(token: string): Promise<VerifyResult> {
    if (token !== this.userId) return { ok: false, reason: 'unauthorized' };
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, this.userId),
      columns: { id: true },
    });
    return user ? { ok: true } : { ok: false, reason: 'unauthorized' };
  }

  /** Best-effort claim capture (scope intent: BAY_SCOPES.write): push the
   * throwaway profile text through capture.commit with the sha256 captureId
   * for retry idempotency. false means it did not land; the claim flow reports
   * that honestly and a retry with the same captureId is safe. */
  async capture(token: string, payload: { text: string; id?: string }): Promise<boolean> {
    if (token !== this.userId) throw new WingmicAuthError();
    if (!payload?.text) return false;
    try {
      const caller = captureRouter.createCaller(apiCallerContext(this.userId, this.headers));
      await caller.commit({
        transcript: payload.text.slice(0, 10000),
        clientCaptureId: payload.id,
      });
      return true;
    } catch (e) {
      if (e instanceof WingmicAuthError) throw e;
      console.warn('[bay] capture degraded:', e instanceof Error ? e.message : e);
      return false;
    }
  }
}

/** Production wiring: the user-backed boundary when a session is present, null
 * otherwise — the anonymous path needs no principal (locked decision 3). The
 * mock client from packages/bay stays a test fixture and is never wired here. */
export function makeWingmicClient(
  session: TRPCContext['session'],
  db: Db,
  headers?: Headers,
): WingmicUserService | null {
  const userId = session?.user?.id;
  if (!userId) return null;
  return new WingmicUserService(db, userId, headers);
}

/** The old /api/link idempotency key, kept: "bay-claim-<sha256(text)[0..16]>".
 * A double-clicked claim lands on the same captureId, so capture.commit
 * dedupes. */
export function bayClaimCaptureId(text: string, provided?: string): string {
  if (provided) return provided;
  const hash = createHash('sha256').update(text).digest('hex').slice(0, 16);
  return `bay-claim-${hash}`;
}
