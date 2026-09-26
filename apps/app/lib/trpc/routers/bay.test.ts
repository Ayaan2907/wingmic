// @vitest-environment node
// Server-side test: the router chain reaches the db client singleton, whose
// env module needs the node environment (jsdom makes loadEnv take the client
// branch, where TURSO_DB_URL is undefined by design).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@wingmic/db/schema';
import { embedText } from '@wingmic/extractor/embeddings';

// The explain stage is mocked so tests never touch OpenRouter: default null →
// the deterministic template answers. One test swaps in a throwing chat to pin
// "a score never fails because the explainer did".
vi.mock('@/lib/bay/chat', async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return { ...real, getExplainChat: vi.fn(() => null) };
});

// No embeddings in these tests — the ask must degrade to the pure text ranker
// (the router catches), and recall falls back or errors into the boundary's
// degrade-to-[] discipline.
vi.mock('@wingmic/extractor/embeddings', async (orig) => {
  const real = (await orig()) as Record<string, unknown>;
  return {
    ...real,
    embedText: vi.fn(async () => {
      throw new Error('no embeddings in tests');
    }),
  };
});

import { getExplainChat } from '@/lib/bay/chat';
import type { BayRecord } from '@wingmic/bay';
import { WingmicAuthError } from '@wingmic/bay';
import { createBayRouter } from './bay';
import { WingmicUserService } from '@/lib/bay/wingmic';
import { ExpiredEventError } from '@/lib/bay/errors';

const NOW = Date.now();
const HOUR = 3_600_000;
const userId = 'user_bay';

/** drizzle's timestamp mode stores seconds — the fixture seeds seconds. */
const SEC = (ms: number): number => Math.floor(ms / 1000);

const liveEvent = {
  id: 'luma:live-demo-night',
  canonical_event_id: null,
  source: 'luma',
  external_id: 'demo-night',
  title: 'demo night at the foundry',
  venue: 'the foundry',
  lat: 37.7749,
  lng: -122.4194,
  price: 'free',
  category: 'events',
  url: 'https://lu.ma/demo-night',
  note: 'builders show what they shipped',
  starts_at: NOW - HOUR,
  ends_at: NOW + 2 * HOUR,
  expires_at: null,
  first_seen_at: NOW - 24 * HOUR,
  fetched_at: NOW - HOUR,
  embedding: null,
};

const expiredEvent = {
  ...liveEvent,
  id: 'luma:old-hackathon',
  external_id: 'old-hackathon',
  title: 'old hackathon',
  category: 'hackathons',
  url: 'https://lu.ma/old-hackathon',
  starts_at: NOW - 96 * HOUR,
  ends_at: NOW - 72 * HOUR, // past the 24h grace → expired, retained as history
};

async function seedDb(): Promise<{
  client: ReturnType<typeof createClient>;
  db: ReturnType<typeof drizzle<typeof schema>>;
}> {
  const client = createClient({ url: ':memory:' });
  const db = drizzle(client, { schema });
  await client.executeMultiple(`
    CREATE TABLE user (
      id TEXT PRIMARY KEY, email TEXT NOT NULL, email_verified INTEGER DEFAULT 0,
      name TEXT, image TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      acknowledged_privacy INTEGER DEFAULT false NOT NULL
    );
    CREATE TABLE interaction (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, transcript TEXT NOT NULL,
      captured_at INTEGER NOT NULL, created_at INTEGER NOT NULL, client_capture_id TEXT
    );
    CREATE TABLE interaction_attachment (
      id TEXT PRIMARY KEY, interaction_id TEXT NOT NULL, entity_id TEXT, event_id TEXT,
      mime_type TEXT DEFAULT 'image/jpeg', jpeg_base64 TEXT, storage_key TEXT
    );
    CREATE TABLE entity_fact (
      id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, source_interaction_id TEXT
    );
    CREATE TABLE entity_topic (
      id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, source_interaction_id TEXT
    );
    CREATE TABLE identity_claim (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, value TEXT NOT NULL,
      verified INTEGER DEFAULT false NOT NULL, public INTEGER DEFAULT false NOT NULL,
      created_at INTEGER,
      UNIQUE (user_id, kind, value)
    );
    CREATE TABLE usage_daily (
      user_id TEXT NOT NULL, day TEXT NOT NULL, kind TEXT NOT NULL,
      count INTEGER DEFAULT 0 NOT NULL, PRIMARY KEY (user_id, day, kind)
    );
    CREATE TABLE bay_events (
      id TEXT PRIMARY KEY, canonical_event_id TEXT, source TEXT NOT NULL, external_id TEXT NOT NULL,
      title TEXT NOT NULL, venue TEXT, lat REAL, lng REAL, price TEXT, category TEXT NOT NULL,
      url TEXT NOT NULL, note TEXT, starts_at INTEGER, ends_at INTEGER, expires_at INTEGER,
      first_seen_at INTEGER NOT NULL, fetched_at INTEGER NOT NULL, embedding F32_BLOB(1536)
    );
    CREATE TABLE places (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, note TEXT NOT NULL,
      category TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL, source TEXT,
      embedding F32_BLOB(1536), fetched_at INTEGER NOT NULL, first_seen_at INTEGER NOT NULL
    );
    INSERT INTO user (id, email, name, created_at, updated_at, acknowledged_privacy)
      VALUES ('${userId}', 'bay@test.dev', 'Bay Viewer', 1, 1, 0);
    INSERT INTO bay_events (
      id, source, external_id, title, venue, lat, lng, price, category, url, note,
      starts_at, ends_at, expires_at, first_seen_at, fetched_at
    ) VALUES
      ('${liveEvent.id}', '${liveEvent.source}', '${liveEvent.external_id}', '${liveEvent.title}',
       '${liveEvent.venue}', ${liveEvent.lat}, ${liveEvent.lng}, '${liveEvent.price}',
       '${liveEvent.category}', '${liveEvent.url}', '${liveEvent.note}',
       ${SEC(liveEvent.starts_at)}, ${SEC(liveEvent.ends_at)}, NULL, ${SEC(liveEvent.first_seen_at)}, ${SEC(liveEvent.fetched_at)}),
      ('${expiredEvent.id}', '${expiredEvent.source}', '${expiredEvent.external_id}', '${expiredEvent.title}',
       '${expiredEvent.venue}', ${expiredEvent.lat}, ${expiredEvent.lng}, '${expiredEvent.price}',
       '${expiredEvent.category}', '${expiredEvent.url}', '${expiredEvent.note}',
       ${SEC(expiredEvent.starts_at)}, ${SEC(expiredEvent.ends_at)}, NULL, ${SEC(expiredEvent.first_seen_at)}, ${SEC(expiredEvent.fetched_at)});
    INSERT INTO places (id, slug, name, note, category, lat, lng, source, fetched_at, first_seen_at) VALUES
      ('seed:foundry', 'foundry', 'the foundry', 'where the builders actually are', 'startups', 37.7749, -122.4194, 'https://foundry.example', ${SEC(NOW)}, ${SEC(NOW)}),
      ('seed:park', 'park', 'dolores park', 'sunny and loud on weekends', 'sports', 37.7596, -122.4269, NULL, ${SEC(NOW)}, ${SEC(NOW)}),
      ('seed:badsource', 'badsource', 'shady spot', 'a place with an insecure link', 'events', 37.76, -122.42, 'http://insecure.example', ${SEC(NOW)}, ${SEC(NOW)}),
      ('seed:badcat', 'badcat', 'mystery spot', 'a category the map does not know', 'coworking', 37.76, -122.42, NULL, ${SEC(NOW)}, ${SEC(NOW)});
  `);
  return { client, db };
}

type Ctx = Parameters<ReturnType<typeof createBayRouter>['createCaller']>[0];

function callerFor(db: ReturnType<typeof drizzle<typeof schema>>, opts: { signedIn?: boolean } = {}) {
  const ctx = {
    db,
    headers: new Headers({ 'x-forwarded-for': '10.9.9.9' }),
    user: opts.signedIn ? { id: userId } : undefined,
    session: opts.signedIn ? { user: { id: userId } } : undefined,
  } as unknown as Ctx;
  // one router instance per caller → fresh rate-limit windows per test
  return createBayRouter().createCaller(ctx);
}

/** tRPC errors surface as thrown TRPCError instances; return the error. */
async function errOf(p: Promise<unknown>): Promise<{ code?: string; bayHttpStatus?: number; name?: string }> {
  try {
    await p;
  } catch (e) {
    const err = e as { code?: string; bayHttpStatus?: number; name?: string };
    return { code: err.code, bayHttpStatus: err.bayHttpStatus, name: err.name };
  }
  throw new Error('expected the call to throw');
}

const pasteProfile = { text: 'engineer moving to sf, into agent infra and evals' };

describe('bay.places (public read)', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    ({ db } = await seedDb());
  });

  it('serves live places and surfaces boundary rejections honestly', async () => {
    const caller = callerFor(db);
    const res = await caller.places();
    const ids = res.records.map((r) => r.id);
    expect(ids).toContain('seed:foundry');
    expect(ids).toContain('seed:park');
    // a category the map does not know is excluded — surfaced, never silent
    expect(ids).not.toContain('seed:badcat');
    expect(res.readErrors.join(' ')).toContain('seed:badcat');
    // non-https source link is omitted from the record, with a read error
    const shady = res.records.find((r) => r.id === 'seed:badsource');
    expect(shady).toBeDefined();
    expect(shady?.sourceUrl).toBeUndefined();
    expect(res.readErrors.join(' ')).toContain('seed:badsource');
  });

  it('filters by known layer and 400s an unknown one', async () => {
    const caller = callerFor(db);
    const res = await caller.places({ layers: ['startups'] });
    expect(res.records.map((r) => r.id)).toEqual(['seed:foundry']);
    await expect(caller.places({ layers: ['nope'] })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('bay.events (public read, persona param)', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    ({ db } = await seedDb());
  });

  it('applies the serve-time expiry filter — expired count surfaced, nothing deleted', async () => {
    const caller = callerFor(db);
    const res = await caller.events();
    expect(res.records.map((r) => r.id)).toEqual([liveEvent.id]);
    expect(res.expired).toBe(1);
    expect(res.total).toBe(1);
  });

  it('ranks under a known persona and 400s an unknown one (never a silent unranked 200)', async () => {
    const caller = callerFor(db);
    const res = await caller.events({ persona: 'hiring' });
    expect(res.persona?.id).toBe('hiring');
    expect(Array.isArray(res.persona?.ranked)).toBe(true);
    await expect(caller.events({ persona: 'nope' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('bay.ask (public)', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    vi.mocked(getExplainChat).mockReset();
    vi.mocked(getExplainChat).mockReturnValue(null);
    ({ db } = await seedDb());
  });

  it('answers signed-out from a browser-held profile — template wording, text retrieval', async () => {
    const caller = callerFor(db);
    const res = await caller.ask({ q: 'what events are on this week?', clientProfile: pasteProfile });
    expect(res.intent).toBe('event');
    expect(res.answer.length).toBeGreaterThan(0);
    expect(res.explain).toBe('template'); // no key configured → honest fallback
    expect(res.retrieval).toBe('text'); // embedding path degraded and said so
    expect(Array.isArray(res.picks)).toBe(true);
    expect(res.emphasis.length).toBeGreaterThan(0);
    // nothing was stored server-side before claim (locked decision 3)
    const rows = await db.all<{ n: number }>(`SELECT COUNT(*) AS n FROM interaction`);
    expect(Number(rows[0]?.n)).toBe(0);
  });

  it('answers signed-in — thin user-row profile, degraded overlap cannot fail the ask', async () => {
    const caller = callerFor(db, { signedIn: true });
    const res = await caller.ask({ q: 'what events are on this week?' });
    expect(res.answer.length).toBeGreaterThan(0);
    expect(res.explain).toBe('template');
    expect(res.profile.kind.length).toBeGreaterThan(0); // the thin user-row profile rode along
  });

  it('falls back to the template when the explainer throws — never a failed ask', async () => {
    vi.mocked(getExplainChat).mockReturnValueOnce(async () => {
      throw new Error('llm down');
    });
    const caller = callerFor(db);
    const res = await caller.ask({ q: 'what events are on this week?', clientProfile: pasteProfile });
    expect(res.answer.length).toBeGreaterThan(0);
    expect(res.explain).toBe('template');
  });

  it('ranks through the real F32 vector path when embeddings resolve — retrieval: embeddings', async () => {
    // the one novel SQL in this diff — vector_distance_cos over F32_BLOB(1536)
    // — must actually execute in the suite: a malformed vector query would
    // otherwise invisibly degrade every ask in production (caught → text rank,
    // the only signal being retrieval: 'text')
    vi.mocked(embedText).mockResolvedValueOnce(new Array<number>(1536).fill(0.1));
    await db
      .update(schema.bayEvents)
      .set({ embedding: new Array<number>(1536).fill(0.5) })
      .where(eq(schema.bayEvents.id, 'luma:live-demo-night'));
    const caller = callerFor(db);
    const res = await caller.ask({ q: 'what events are on this week?', clientProfile: pasteProfile });
    expect(res.retrieval).toBe('embeddings');
    expect(res.answer.length).toBeGreaterThan(0);
  });

  it('rate limits per ip', async () => {
    const ctx = {
      db,
      headers: new Headers({ 'x-forwarded-for': '10.0.0.7' }),
      user: undefined,
      session: undefined,
    } as unknown as Ctx;
    const caller = createBayRouter({ askPerHour: 1 }).createCaller(ctx);
    await caller.ask({ q: 'what events are on this week?' });
    await expect(caller.ask({ q: 'what events are on this week?' })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
  });
});

describe('bay.score (public)', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    ({ db } = await seedDb());
  });

  it('404s an unknown event', async () => {
    const caller = callerFor(db);
    const err = await errOf(caller.score({ eventId: 'nope', clientProfile: pasteProfile }));
    expect(err.code).toBe('NOT_FOUND');
    expect(err.name).not.toBe('ExpiredEventError');
  });

  it('410s a known-but-over event — history kept, live board not', async () => {
    const caller = callerFor(db);
    const err = await errOf(caller.score({ eventId: expiredEvent.id, clientProfile: pasteProfile }));
    expect(err.name).toBe('ExpiredEventError');
    expect(err.bayHttpStatus).toBe(410);
    expect(err.code).toBe('NOT_FOUND');
  });

  it('400s when there is nothing to read a profile from', async () => {
    const caller = callerFor(db);
    const err = await errOf(caller.score({ eventId: liveEvent.id }));
    expect(err.code).toBe('BAD_REQUEST');
  });

  it('scores deterministically from a pasted profile without a key', async () => {
    const caller = callerFor(db);
    const first = await caller.score({ eventId: liveEvent.id, clientProfile: pasteProfile });
    expect(first.ok).toBe(true);
    expect(first.event?.id).toBe(liveEvent.id);
    expect(typeof first.score?.go).toBe('number');
    expect(first.score?.verdict).toBeDefined();
    expect(first.profile?.quality).toBeTruthy();
    const second = await caller.score({ eventId: liveEvent.id, clientProfile: pasteProfile });
    expect(second.score?.go).toBe(first.score?.go); // fixed weights, no llm — same numbers
  });

  it('scores signed-in with degraded overlap — an empty graph cannot fail a score', async () => {
    const caller = callerFor(db, { signedIn: true });
    const res = await caller.score({ eventId: liveEvent.id });
    expect(res.ok).toBe(true);
    expect(res.score).toBeDefined();
  });

  it('rate limits per ip', async () => {
    const ctx = {
      db,
      headers: new Headers({ 'x-forwarded-for': '10.0.0.8' }),
      user: undefined,
      session: undefined,
    } as unknown as Ctx;
    const caller = createBayRouter({ scorePerHour: 2 }).createCaller(ctx);
    await caller.score({ eventId: liveEvent.id, clientProfile: pasteProfile });
    await caller.score({ eventId: liveEvent.id, clientProfile: pasteProfile });
    await expect(caller.score({ eventId: liveEvent.id, clientProfile: pasteProfile })).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
    });
  });
});

describe('bay.claim (protected)', () => {
  let client: ReturnType<typeof createClient>;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    ({ client, db } = await seedDb());
  });

  const claimInput = {
    clientProfile: {
      text: 'sam rivera — engineer moving to sf, into agent infra and evals',
      name: 'sam rivera',
      links: { linkedin: 'https://www.linkedin.com/in/sam-rivera' },
    },
    captureId: 'claim-test-0001',
  };

  it('refuses the signed-out', async () => {
    const caller = callerFor(db);
    const err = await errOf(caller.claim(claimInput));
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('double-submit lands on one capture (clientCaptureId idempotency) and one identity claim', async () => {
    // pre-insert the interaction the first claim will have written — the
    // capture pipeline's dedupe reads it before any extraction runs
    await client.execute({
      sql: `INSERT INTO interaction (id, user_id, transcript, captured_at, created_at, client_capture_id)
            VALUES ('int_claim', '${userId}', 'sam rivera paste', 1, 1, 'claim-test-0001')`,
    });
    const caller = callerFor(db, { signedIn: true });
    const first = await caller.claim(claimInput);
    const second = await caller.claim(claimInput);
    expect(first.captured).toBe(true);
    expect(second.captured).toBe(true);
    expect(second.captureId).toBe(first.captureId);
    expect(first.identityClaim).toEqual({ kind: 'linkedin', value: 'https://www.linkedin.com/in/sam-rivera' });
    // the retry resolved the existing identity claim instead of duplicating it
    expect(second.identityClaim).toEqual(first.identityClaim);
    const ints = await client.execute({ sql: `SELECT COUNT(*) AS n FROM interaction`, args: [] });
    expect(Number(ints.rows[0]?.n)).toBe(1);
    const claims = await client.execute({ sql: `SELECT COUNT(*) AS n FROM identity_claim`, args: [] });
    expect(Number(claims.rows[0]?.n)).toBe(1);
  });

  it('reports an honest captured:false when the capture pipeline fails — nothing pretends', async () => {
    // no pre-inserted interaction: the real commit runs, has no extraction key
    // in this environment, and fails — the claim must say so, not lie
    const caller = callerFor(db, { signedIn: true });
    const res = await caller.claim(claimInput);
    expect(res.captured).toBe(false);
    expect(res.note).toBeTruthy();
    expect(res.identityClaim).toBeNull();
  });
});

describe('bay boundary service (the _wingmic.js shape)', () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    ({ db } = await seedDb());
  });

  const event = {
    id: liveEvent.id,
    type: 'event',
    category: 'events',
    title: liveEvent.title,
    source: 'luma',
    venue: liveEvent.venue,
    lat: liveEvent.lat,
    lng: liveEvent.lng,
    note: liveEvent.note,
    url: liveEvent.url,
    fetchedAt: new Date(NOW).toISOString(),
    firstSeenAt: new Date(NOW).toISOString(),
  } as BayRecord;

  it('throws the auth error when the token slot does not carry the session userId', async () => {
    const svc = new WingmicUserService(db, userId);
    await expect(svc.networkOverlap('caller-chosen-token', { event })).rejects.toThrow(WingmicAuthError);
    await expect(svc.capture('caller-chosen-token', { text: 'hi' })).rejects.toThrow(WingmicAuthError);
  });

  it('verifies the session userId against the user row', async () => {
    const svc = new WingmicUserService(db, userId);
    await expect(svc.verify(userId)).resolves.toEqual({ ok: true });
    await expect(svc.verify('someone-else')).resolves.toEqual({ ok: false, reason: 'unauthorized' });
  });

  it('degrades network overlap to [] when the graph is unreachable — never breaks a score', async () => {
    // a db without the entity tables: recall has nothing to query
    const bare = createClient({ url: ':memory:' });
    const bareDb = drizzle(bare, { schema });
    const svc = new WingmicUserService(bareDb, userId);
    await expect(svc.networkOverlap(userId, { event })).resolves.toEqual([]);
  });

  it('degrades capture to false when the capture pipeline is unreachable', async () => {
    const bare = createClient({ url: ':memory:' });
    const bareDb = drizzle(bare, { schema });
    const svc = new WingmicUserService(bareDb, userId);
    await expect(svc.capture(userId, { text: 'a paste' })).resolves.toBe(false);
  });
});
