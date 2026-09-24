import { describe, it, expect, vi } from 'vitest';

// Mutable env mock — the fallback-stream leg reads the key at call time.
vi.mock('@/lib/config/env', () => ({
  env: {
    OPENROUTER_API_KEY: undefined as string | undefined,
    CHAT_ASSISTANT_MODEL: undefined,
    ACTS_DRAFT_MODEL: undefined,
  },
}));

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { resolve } from 'node:path';
import * as schema from '@wingmic/db/schema';
import { hydrateThreadItems } from '../hydrateThread';
import {
  assistantFollowUp,
  assistantFallbackReply,
  buildAssistantPrompt,
  streamAssistantTurn,
  summarizeTurn,
  type TurnDiff,
} from '../assistant';

async function setupDb() {
  const client = createClient({ url: 'file::memory:' });
  const db = drizzle(client, { schema });
  await migrate(db, {
    migrationsFolder: resolve(__dirname, '../../../../../packages/db/drizzle'),
  });
  return { client, db };
}

async function collect(text: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const chunk of text) out += chunk;
  return out;
}

/**
 * The spec's acceptance test (art_LkglG0Xb "Chat-first capture"): a
 * three-turn conversation starting from a partial description produces
 * graph entities with provenance and follow-ups. Extraction itself is
 * LLM-backed (covered by the extractor suite); this exercises the
 * conversation layer over exactly the rows the capture pipeline writes —
 * threaded by parentInteractionId, facts at resolution.ts confidences.
 */
describe('3-turn capture conversation', () => {
  it('resolves a partial description into provenance-backed entities and follow-ups', async () => {
    const { client, db } = await setupDb();
    const now = new Date();
    const t1 = new Date(now.getTime() + 1_000);
    const t2 = new Date(now.getTime() + 2_000);
    const t3 = new Date(now.getTime() + 3_000);

    await db.insert(schema.users).values({
      id: 'u1',
      name: 'Ada',
      email: 'ada@example.com',
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });

    // Turn 1 — partial description: a name and a company, nothing else.
    await db.insert(schema.interactions).values({
      id: 'ix_t1',
      userId: 'u1',
      transcript: 'met sarah chen at acme today',
      capturedAt: t1,
      status: 'committed',
    });
    // Turn 2 — threaded follow-up completes the picture (role + topic).
    await db.insert(schema.interactions).values({
      id: 'ix_t2',
      userId: 'u1',
      transcript: "she's the eng lead doing edge config stuff",
      capturedAt: t2,
      status: 'committed',
      parentInteractionId: 'ix_t1',
    });
    // Turn 3 — explicit contact info plus a queued follow-up act.
    await db.insert(schema.interactions).values({
      id: 'ix_t3',
      userId: 'u1',
      transcript: 'her email is sarah@acme.dev — intro her to ravi this week',
      capturedAt: t3,
      status: 'committed',
      parentInteractionId: 'ix_t1',
    });

    await db.insert(schema.entities).values({
      id: 'e1',
      ownerUserId: 'u1',
      kind: 'person',
      name: 'Sarah Chen',
      createdAt: t1,
      updatedAt: t3,
    });
    await db.insert(schema.companies).values({
      id: 'c1',
      name: 'Acme',
      slug: 'acme',
      observedCount: 1,
      createdAt: t1,
    });
    await db.insert(schema.topics).values({
      id: 'tp1',
      name: 'edge config',
      slug: 'edge-config',
      createdAt: t2,
    });

    // Pipeline-written rows: company edge at turn 1; role fact at 80
    // (resolution.ts inferred), email at 95 (explicit); topic edge at
    // turn 2; a drafted follow-up act at turn 3.
    await db.insert(schema.entityCompanies).values({
      id: 'ec1',
      entityId: 'e1',
      companyId: 'c1',
      createdAt: t1,
      sourceDeleted: false,
    });
    await db.insert(schema.entityFacts).values([
      {
        // resolution.ts writes a note fact on every captured person — this
        // is what attributes Sarah to turn 1 in hydration.
        id: 'f_note',
        entityId: 'e1',
        key: 'note',
        value: 'met at acme today',
        sourceInteractionId: 'ix_t1',
        confidence: 80,
        createdAt: t1,
      },
      {
        id: 'f_role',
        entityId: 'e1',
        key: 'role',
        value: 'eng lead',
        sourceInteractionId: 'ix_t2',
        confidence: 80,
        createdAt: t2,
      },
      {
        id: 'f_email',
        entityId: 'e1',
        key: 'email',
        value: 'sarah@acme.dev',
        sourceInteractionId: 'ix_t3',
        confidence: 95,
        createdAt: t3,
      },
    ]);
    await db.insert(schema.entityTopics).values({
      id: 'et1',
      entityId: 'e1',
      topicId: 'tp1',
      weight: 50,
      sourceInteractionId: 'ix_t2',
      createdAt: t2,
      sourceDeleted: false,
    });
    await db.insert(schema.acts).values({
      id: 'a1',
      userId: 'u1',
      kind: 'email',
      status: 'drafted',
      body: 'intro sarah to ravi',
      whenHint: 'this week',
      sourceInteractionId: 'ix_t3',
      targetEntityId: 'e1',
      createdAt: t3,
      updatedAt: t3,
    });

    const rowOf = (id: string, transcript: string, capturedAt: Date) => ({
      id,
      transcript,
      capturedAt,
    });

    // Hydrate each turn the way the conversation surface does.
    const [turn1] = await hydrateThreadItems(db as never, 'u1', [
      rowOf('ix_t1', 'met sarah chen at acme today', t1),
    ]);
    const [turn2] = await hydrateThreadItems(db as never, 'u1', [
      rowOf('ix_t2', "she's the eng lead doing edge config stuff", t2),
    ]);
    const [turn3] = await hydrateThreadItems(db as never, 'u1', [
      rowOf('ix_t3', 'her email is sarah@acme.dev — intro her to ravi this week', t3),
    ]);

    type HydratedItem = Awaited<ReturnType<typeof hydrateThreadItems>>[number];
    const diffOf = (item: HydratedItem): TurnDiff => ({
      persons: item.graphResult.extracted.persons.map((p) => ({
        name: p.name,
        role: p.role,
        companyHint: p.companyHint,
      })),
      topics: item.graphResult.extracted.topics,
      actions: item.graphResult.extracted.actions.map((a) => ({
        kind: a.kind,
        body: a.body,
      })),
    });

    // Turn 1: partial — the entity lands, and the assistant asks exactly
    // one question about what's missing. Graph entity + follow-up ✓.
    expect(turn1!.graphResult.extracted.persons[0]?.name).toBe('Sarah Chen');
    expect(turn1!.graphResult.extracted.persons[0]?.role).toBeNull();
    expect(turn1!.graphResult.extracted.persons[0]?.companyHint).toBe('Acme');
    expect(assistantFollowUp(diffOf(turn1!))).toEqual({
      question: 'what does sarah do at Acme?',
      about: 'Sarah Chen',
    });

    // Turn 2: the threaded turn resolves the gap; the role field carries
    // provenance — user-sourced at the fact's confidence 80.
    const p2 = turn2!.graphResult.extracted.persons[0]!;
    expect(p2.role).toBe('eng lead');
    expect(p2.companyHint).toBe('Acme');
    expect(p2.fieldProvenance?.role).toEqual({ source: 'user', confidence: 80 });
    expect(turn2!.graphResult.extracted.topics).toContain('edge config');
    expect(assistantFollowUp(diffOf(turn2!))).toBeNull();

    // Turn 3: explicit contact info at confidence 95, and the queued
    // follow-up act surfaces as an action — the assistant stays quiet and
    // acks the commitment instead of asking anything. Per-turn diffs stay
    // per-turn: turn 3 captured no role facts, so no role provenance here.
    const p3 = turn3!.graphResult.extracted.persons[0]!;
    expect(p3.name).toBe('Sarah Chen');
    expect(p3.role).toBeNull();
    expect(turn3!.graphResult.extracted.actions[0]?.body).toBe('intro sarah to ravi');
    expect(assistantFollowUp(diffOf(turn3!))).toBeNull();
    expect(assistantFallbackReply(diffOf(turn3!))).toBe(
      'noted — follow-up queued.',
    );

    // The full thread hydrates as one conversation for the assistant's
    // history — oldest first, each turn summarized.
    const thread = await hydrateThreadItems(db as never, 'u1', [
      rowOf('ix_t1', 'met sarah chen at acme today', t1),
      rowOf('ix_t2', "she's the eng lead doing edge config stuff", t2),
      rowOf('ix_t3', 'her email is sarah@acme.dev — intro her to ravi this week', t3),
    ]);
    expect(thread.map((t) => t.id)).toEqual(['ix_t1', 'ix_t2', 'ix_t3']);

    const prompt = buildAssistantPrompt({
      turnText: 'her email is sarah@acme.dev — intro her to ravi this week',
      diff: diffOf(turn3!),
      history: thread.slice(0, 2).map((t) => ({
        transcript: t.transcript,
        summary: summarizeTurn(diffOf(t)),
      })),
    });
    expect(prompt).toContain('earlier turns in this thread (oldest first):');
    expect(prompt.indexOf('met sarah chen at acme today')).toBeLessThan(
      prompt.indexOf("she's the eng lead doing edge config stuff"),
    );
    expect(prompt).toContain('Ask no question');

    // Without OPENROUTER_API_KEY the same turn still streams a deterministic
    // reply — the conversation degrades, never dies.
    const res = await streamAssistantTurn({
      turnText: 'met sarah chen at acme today',
      diff: diffOf(turn1!),
      history: [],
    });
    expect(res.source).toBe('fallback');
    expect(await collect(res.text)).toBe('noted — Sarah Chen, Acme.');

    client.close();
  });
});
