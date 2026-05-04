import { customType, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';

/**
 * libSQL native vector column. Values round-trip as `number[]` of length `size`.
 * Stored on disk as F32_BLOB(size). 1536 dims matches OpenAI text-embedding-3-small.
 */
const float32Blob = (size: number) =>
  customType<{ data: number[]; driverData: Buffer; notNull: false }>({
    dataType() {
      return `F32_BLOB(${size})`;
    },
    toDriver(value: number[]): Buffer {
      const f32 = new Float32Array(value);
      return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
    },
    fromDriver(value: Buffer | Uint8Array): number[] {
      const buf =
        value instanceof Buffer
          ? value
          : Buffer.from(value.buffer, value.byteOffset, value.byteLength);
      return Array.from(new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4));
    },
  });

const ts = (col: string) =>
  integer(col, { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date());

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => createId());

// ─── User layer (BetterAuth-compatible base) ────────────────────────────

export const users = sqliteTable('user', {
  id: id(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  name: text('name'),
  image: text('image'),
  createdAt: ts('created_at'),
  updatedAt: ts('updated_at'),
});

// BetterAuth core tables — kept in sync with @better-auth/cli expectations.
// See https://better-auth.com/docs/concepts/database#schema

export const sessions = sqliteTable(
  'session',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);

export const accounts = sqliteTable(
  'account',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [index('account_user_idx').on(t.userId)],
);

export const verifications = sqliteTable(
  'verification',
  {
    id: id(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);

export const identityClaims = sqliteTable(
  'identity_claim',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', {
      enum: ['email', 'linkedin', 'twitter', 'github', 'phone', 'url'],
    }).notNull(),
    value: text('value').notNull(),
    verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
    public: integer('public', { mode: 'boolean' }).notNull().default(false),
    createdAt: ts('created_at'),
  },
  (t) => [
    index('identity_claim_kind_value_idx').on(t.kind, t.value),
    index('identity_claim_user_idx').on(t.userId),
  ],
);

// ─── Canonical layer (shared, lazy promotion when observedCount >= 2) ──

export const companies = sqliteTable(
  'company',
  {
    id: id(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    domain: text('domain'),
    industry: text('industry', { mode: 'json' }).$type<string[]>(),
    observedCount: integer('observed_count').notNull().default(1),
    promotedAt: integer('promoted_at', { mode: 'timestamp' }),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [
    index('company_domain_idx').on(t.domain),
    index('company_name_idx').on(t.name),
  ],
);

export const events = sqliteTable(
  'event',
  {
    id: id(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    dateRangeStart: integer('date_range_start', { mode: 'timestamp' }),
    dateRangeEnd: integer('date_range_end', { mode: 'timestamp' }),
    location: text('location'),
    url: text('url'),
    observedCount: integer('observed_count').notNull().default(1),
    promotedAt: integer('promoted_at', { mode: 'timestamp' }),
    createdAt: ts('created_at'),
  },
  (t) => [index('event_name_idx').on(t.name)],
);

export const topics = sqliteTable('topic', {
  id: id(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  aliases: text('aliases', { mode: 'json' }).$type<string[]>().default([]),
  parentId: text('parent_id'),
  createdAt: ts('created_at'),
});

// ─── Entities (Person-only for v0.1.1) ─────────────────────────────────

export const entities = sqliteTable(
  'entity',
  {
    id: id(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['person'] }).notNull().default('person'),
    name: text('name').notNull(),
    aliases: text('aliases', { mode: 'json' }).$type<string[]>().default([]),
    importSource: text('import_source'),
    embedding: float32Blob(1536)('embedding'),
    createdAt: ts('created_at'),
    updatedAt: ts('updated_at'),
  },
  (t) => [
    index('entity_owner_idx').on(t.ownerUserId),
    index('entity_owner_name_idx').on(t.ownerUserId, t.name),
  ],
);

export const entityResolutions = sqliteTable(
  'entity_resolution',
  {
    id: id(),
    entityId: text('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    resolvedUserId: text('resolved_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    byClaimId: text('by_claim_id').references(() => identityClaims.id, {
      onDelete: 'set null',
    }),
    mutualConsentTs: integer('mutual_consent_ts', { mode: 'timestamp' }),
    createdAt: ts('created_at'),
  },
  (t) => [index('entity_resolution_entity_idx').on(t.entityId)],
);

// ─── Interactions, Facts, Notes ────────────────────────────────────────

export const interactions = sqliteTable(
  'interaction',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    transcript: text('transcript').notNull(),
    capturedAt: integer('captured_at', { mode: 'timestamp' }).notNull(),
    embedding: float32Blob(1536)('embedding'),
    createdAt: ts('created_at'),
  },
  (t) => [
    index('interaction_user_idx').on(t.userId),
    index('interaction_captured_at_idx').on(t.capturedAt),
  ],
);

export const entityFacts = sqliteTable(
  'entity_fact',
  {
    id: id(),
    entityId: text('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value').notNull(),
    sourceInteractionId: text('source_interaction_id').references(() => interactions.id, {
      onDelete: 'set null',
    }),
    confidence: integer('confidence').notNull().default(85),
    embedding: float32Blob(1536)('embedding'),
    createdAt: ts('created_at'),
  },
  (t) => [index('entity_fact_entity_idx').on(t.entityId)],
);

export const entityNotes = sqliteTable(
  'entity_note',
  {
    id: id(),
    entityId: text('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: ts('created_at'),
  },
  (t) => [index('entity_note_entity_idx').on(t.entityId)],
);

// ─── Cross-layer edges ─────────────────────────────────────────────────

export const entityCompanies = sqliteTable(
  'entity_company',
  {
    id: id(),
    entityId: text('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    companyId: text('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    role: text('role'),
    since: integer('since', { mode: 'timestamp' }),
    until: integer('until', { mode: 'timestamp' }),
    createdAt: ts('created_at'),
  },
  (t) => [
    index('entity_company_entity_idx').on(t.entityId),
    index('entity_company_company_idx').on(t.companyId),
  ],
);

export const entityEvents = sqliteTable(
  'entity_event',
  {
    id: id(),
    entityId: text('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    role: text('role'),
    createdAt: ts('created_at'),
  },
  (t) => [index('entity_event_entity_idx').on(t.entityId)],
);

export const entityTopics = sqliteTable(
  'entity_topic',
  {
    id: id(),
    entityId: text('entity_id')
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    topicId: text('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    weight: integer('weight').notNull().default(50),
    sourceInteractionId: text('source_interaction_id').references(() => interactions.id, {
      onDelete: 'set null',
    }),
    createdAt: ts('created_at'),
  },
  (t) => [index('entity_topic_entity_idx').on(t.entityId)],
);

// ─── Connection requests (opt-in linking, exposed in v0.2+) ────────────

export const connectionRequests = sqliteTable('connection_request', {
  id: id(),
  fromUserId: text('from_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  toUserId: text('to_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  entityId: text('entity_id').references(() => entities.id, { onDelete: 'set null' }),
  status: text('status', {
    enum: ['pending', 'accepted', 'declined', 'expired'],
  })
    .notNull()
    .default('pending'),
  createdAt: ts('created_at'),
});

// ─── Type exports ──────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type Interaction = typeof interactions.$inferSelect;
export type NewInteraction = typeof interactions.$inferInsert;
export type EntityFact = typeof entityFacts.$inferSelect;
export type EntityNote = typeof entityNotes.$inferSelect;
