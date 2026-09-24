import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import * as schema from '@wingmic/db/schema';

vi.mock('@/lib/acts/draftAgent', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../draftAgent')>();
  return {
    ...mod,
    polishDraft: vi.fn(async (input: Parameters<typeof mod.polishDraft>[0]) =>
      mod.templateDraft(input),
    ),
  };
});

import { polishDraft, templateDraft } from '../draftAgent';
import {
  draftActsForInteraction,
  markInteractionActsFailed,
  scheduleActDrafting,
  sweepStaleDrafting,
} from '../scheduleActDrafting';

const polishDraftMock = vi.mocked(polishDraft);

describe('scheduleActDrafting (deferred acts drafting, spec D2)', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let client: ReturnType<typeof createClient>;
  const userId = 'user_draft';
  const otherUserId = 'user_other';
  let now = Date.now();

  beforeAll(async () => {
    client = createClient({ url: ':memory:' });
    db = drizzle(client, { schema });

    await client.executeMultiple(`
      CREATE TABLE entity (
        id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, kind TEXT DEFAULT 'person',
        name TEXT NOT NULL, aliases TEXT DEFAULT '[]', import_source TEXT,
        embedding F32_BLOB(1536), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      );
      CREATE TABLE entity_fact (
        id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, key TEXT NOT NULL,
        value TEXT NOT NULL, source_interaction_id TEXT,
        confidence INTEGER NOT NULL DEFAULT 85,
        embedding F32_BLOB(1536), created_at INTEGER NOT NULL
      );
      CREATE TABLE act (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
        kind TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'drafted',
        body TEXT NOT NULL, subject TEXT, when_hint TEXT, run_at INTEGER,
        target_entity_id TEXT, secondary_entity_id TEXT, source_interaction_id TEXT,
        confidence INTEGER NOT NULL DEFAULT 80,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
    `);
  });

  beforeEach(async () => {
    now = Date.now();
    await client.executeMultiple(`DELETE FROM act; DELETE FROM entity_fact; DELETE FROM entity;`);

    await client.execute({
      sql: `INSERT INTO entity VALUES ('e_ada', ?, 'person', 'Ada Lovelace', '[]', null, null, ?, ?, null)`,
      args: [userId, now, now],
    });
    await client.execute({
      sql: `INSERT INTO entity_fact VALUES ('f_email', 'e_ada', 'email', 'ada@lovelace.dev', null, 90, null, ?)`,
      args: [now],
    });

    polishDraftMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function seedAct(
    id: string,
    opts: {
      userId?: string;
      status?: string;
      target?: string | null;
      source?: string | null;
      kind?: string;
      body?: string;
      createdAtMs?: number;
      updatedAtMs?: number;
    } = {},
  ) {
    await client.execute({
      sql: `INSERT INTO act VALUES (?, ?, ?, ?, ?, null, 'tomorrow', null, ?, null, ?, 80, ?, ?)`,
      args: [
        id,
        opts.userId ?? userId,
        opts.kind ?? 'email',
        opts.status ?? 'drafting',
        opts.body ?? 'send the deck',
        opts.target === undefined ? 'e_ada' : opts.target,
        opts.source ?? 'int_1',
        // drizzle mode:'timestamp' columns store seconds; the sweep's
        // updatedAt comparison runs through drizzle date math.
        Math.floor((opts.createdAtMs ?? now) / 1000),
        Math.floor((opts.updatedAtMs ?? opts.createdAtMs ?? now) / 1000),
      ],
    });
  }

  async function actById(id: string) {
    return db.query.acts.findFirst({ where: eq(schema.acts.id, id) });
  }

  it('drafts a placeholder row in place: drafting → drafted with the target-channel polish', async () => {
    await seedAct('act_1');

    const transcript = 'coffee with ada — send the deck tomorrow';
    await draftActsForInteraction({ db, userId, interactionId: 'int_1', transcript });

    const row = await actById('act_1');
    expect(row?.status).toBe('drafted');
    // Target has an email fact → email channel → follow-up intent template.
    const expected = templateDraft({
      kind: 'email',
      intent: 'follow-up',
      channel: 'email',
      targetName: 'Ada Lovelace',
      secondaryName: null,
      contextName: null,
      seedBody: 'send the deck',
      transcript,
    });
    expect(row?.body).toBe(expected.body);
    expect(row?.subject).toBe(expected.subject);
  });

  it('only touches drafting rows — drafted rows keep their polish', async () => {
    await seedAct('act_drafting');
    await seedAct('act_drafted', { status: 'drafted', body: 'already polished' });

    await draftActsForInteraction({ db, userId, interactionId: 'int_1', transcript: 'memo' });

    expect((await actById('act_drafting'))?.status).toBe('drafted');
    const untouched = await actById('act_drafted');
    expect(untouched?.body).toBe('already polished');
  });

  it('falls back to the memo channel when the target has no identity facts', async () => {
    await seedAct('act_no_fact', { target: null });

    await draftActsForInteraction({ db, userId, interactionId: 'int_1', transcript: 'memo' });

    const row = await actById('act_no_fact');
    expect(row?.status).toBe('drafted');
    const expected = templateDraft({
      kind: 'email',
      intent: 'memo',
      channel: 'memo',
      targetName: null,
      secondaryName: null,
      contextName: null,
      seedBody: 'send the deck',
      transcript: 'memo',
    });
    expect(row?.body).toBe(expected.body);
  });

  it('marks the failing row failed and lets its siblings still draft', async () => {
    await seedAct('act_fails', { target: null });
    await seedAct('act_succeeds', { target: null, body: 'other follow-up' });
    polishDraftMock.mockRejectedValueOnce(new Error('llm down'));

    await draftActsForInteraction({ db, userId, interactionId: 'int_1', transcript: 'memo' });

    const failed = await actById('act_fails');
    expect(failed?.status).toBe('failed');
    expect(failed?.body).toBe('send the deck'); // seed preserved for the retry
    expect((await actById('act_succeeds'))?.status).toBe('drafted');
  });

  it('scheduleActDrafting fails the remaining drafting rows when the run itself throws', async () => {
    await seedAct('act_orphan');
    // Simulate a run-level failure (e.g. DB hiccup loading rows): the whole
    // job rejects, so the scheduler's catch — not the per-row catch — fires.
    const rowsSpy = vi.spyOn(db.query.acts, 'findMany').mockRejectedValueOnce(new Error('db down'));

    scheduleActDrafting({ db, userId, interactionId: 'int_1', transcript: 'memo' });

    await vi.waitFor(
      async () => {
        expect(rowsSpy).toHaveBeenCalled();
        expect(await actById('act_orphan')).toMatchObject({ status: 'failed' });
      },
      { timeout: 2000 },
    );
  });

  it('markInteractionActsFailed is scoped to the user + interaction', async () => {
    await seedAct('act_mine');
    await seedAct('act_other_user', { userId: otherUserId });
    await seedAct('act_other_interaction', { source: 'int_2' });
    await seedAct('act_already_drafted', { status: 'drafted' });

    await markInteractionActsFailed({ db, userId, interactionId: 'int_1' });

    expect((await actById('act_mine'))?.status).toBe('failed');
    expect((await actById('act_other_user'))?.status).toBe('drafting');
    expect((await actById('act_other_interaction'))?.status).toBe('drafting');
    expect((await actById('act_already_drafted'))?.status).toBe('drafted');
  });

  it('sweepStaleDrafting recovers orphaned drafting rows past the grace window', async () => {
    await seedAct('act_stale', { createdAtMs: now - 11 * 60_000 });
    await seedAct('act_fresh', { createdAtMs: now - 60_000 });
    await seedAct('act_stale_drafted', { status: 'drafted', createdAtMs: now - 30 * 60_000 });
    await seedAct('act_stale_failed', { status: 'failed', createdAtMs: now - 30 * 60_000 });

    const recovered = await sweepStaleDrafting(db);

    expect(recovered).toBe(1);
    // Stale drafting → failed (retryable); fresh drafting is still in flight.
    expect((await actById('act_stale'))?.status).toBe('failed');
    expect((await actById('act_fresh'))?.status).toBe('drafting');
    expect((await actById('act_stale_drafted'))?.status).toBe('drafted');
    expect((await actById('act_stale_failed'))?.status).toBe('failed');
  });

  it('a recovered stale row keeps its seed body so retry can re-polish it', async () => {
    await seedAct('act_stale_seed', { createdAtMs: now - 11 * 60_000 });

    await sweepStaleDrafting(db);

    const row = await actById('act_stale_seed');
    expect(row?.status).toBe('failed');
    expect(row?.body).toBe('send the deck');
  });

  it('a retry-claimed row (old createdAt, fresh updatedAt) survives the sweep', async () => {
    // retryDraft claims failed→drafting and bumps only updatedAt; the sweep
    // must judge staleness on updatedAt so an in-flight retry of an old act
    // is never flipped back to failed mid-polish.
    await seedAct('act_retry_claimed', {
      createdAtMs: now - 60 * 60_000,
      updatedAtMs: now - 5_000,
    });

    const recovered = await sweepStaleDrafting(db);

    expect(recovered).toBe(0);
    expect((await actById('act_retry_claimed'))?.status).toBe('drafting');
  });
});
