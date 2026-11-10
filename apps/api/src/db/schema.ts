import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
};

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  // Bumped on logout (and would be on password-change, if that endpoint
  // existed) to invalidate every JWT issued before the bump — see
  // auth.service.ts's issueToken/logout and jwt-auth.guard.ts's check.
  tokenVersion: integer('token_version').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const heroes = pgTable('heroes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  data: jsonb('data').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  isSandbox: boolean('is_sandbox').notNull().default(false),
  ...timestamps,
});

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  ...timestamps,
});

export const scenarios = pgTable('scenarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  status: text('status').notNull().default('pending'),
  data: jsonb('data'),
  ...timestamps,
});

export const saves = pgTable('saves', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const snapshots = pgTable('snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  saveId: uuid('save_id').references(() => saves.id, { onDelete: 'cascade' }),
  scenariosId: uuid('scenarios_id').references(() => scenarios.id, { onDelete: 'cascade' }),
  state: jsonb('state').notNull(),
  // Mirrors state.checksum (a SHA-256 over the rest of the payload, set by
  // packages/engine's serializeState) in a plain column so a truncated/
  // corrupted JSONB blob can be caught before even attempting to parse it.
  checksum: text('checksum').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const accountRoleEnum = pgEnum('account_role', ['player', 'creator', 'admin']);

export const accountRoles = pgTable(
  'account_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: accountRoleEnum('role').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.role] })],
);

export const heroAggregates = pgTable(
  'hero_aggregates',
  {
    heroId: uuid('hero_id')
      .notNull()
      .references(() => heroes.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    revision: integer('revision').notNull(),
    schemaVersion: integer('schema_version').notNull(),
    contentVersion: text('content_version').notNull(),
    state: jsonb('state').notNull(),
    // Server secrets (the RNG seed). Never copied into a response — see aggregate projection.
    serverState: jsonb('server_state').notNull().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.heroId, table.kind] })],
);

export const aggregateSnapshots = pgTable(
  'aggregate_snapshots',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    heroId: uuid('hero_id')
      .notNull()
      .references(() => heroes.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    revision: integer('revision').notNull(),
    state: jsonb('state').notNull(),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('aggregate_snapshots_hero_kind_idx').on(table.heroId, table.kind, table.revision),
  ],
);

export const commandResultEnum = pgEnum('command_result', ['applied', 'rejected', 'conflict']);

export const commandJournal = pgTable(
  'command_journal',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    commandId: uuid('command_id').notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    heroId: uuid('hero_id')
      .notNull()
      .references(() => heroes.id, { onDelete: 'cascade' }),
    expeditionId: uuid('expedition_id'),
    aggregateKind: text('aggregate_kind').notNull(),
    commandType: text('command_type').notNull(),
    payload: jsonb('payload').notNull(),
    expectedRevision: integer('expected_revision'),
    result: commandResultEnum('result').notNull(),
    reason: text('reason'),
    events: jsonb('events').notNull().default([]),
    newRevision: integer('new_revision'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('command_journal_hero_created_idx').on(table.heroId, table.createdAt)],
);

export const itemLedger = pgTable(
  'item_ledger',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    heroId: uuid('hero_id')
      .notNull()
      .references(() => heroes.id, { onDelete: 'cascade' }),
    commandId: uuid('command_id').notNull(),
    itemKey: text('item_key').notNull(),
    itemInstanceId: uuid('item_instance_id'),
    delta: integer('delta').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('item_ledger_hero_item_idx').on(table.heroId, table.itemKey, table.createdAt)],
);

export const expeditions = pgTable(
  'expeditions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hostUserId: uuid('host_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().default('world'),
    seed: text('seed').notNull(),
    revision: integer('revision').notNull().default(0),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [index('expeditions_host_idx').on(table.hostUserId, table.status)],
);

export const expeditionMembers = pgTable(
  'expedition_members',
  {
    expeditionId: uuid('expedition_id')
      .notNull()
      .references(() => expeditions.id, { onDelete: 'cascade' }),
    heroId: uuid('hero_id')
      .notNull()
      .references(() => heroes.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    leftAt: timestamp('left_at', { withTimezone: true, mode: 'string' }),
    controlledByUserId: uuid('controlled_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [primaryKey({ columns: [table.expeditionId, table.heroId] })],
);

// D4a, temporary: the world is still played on the client, so the server keeps what the client
// reports (maps, fog, battle, where the hero is) as opaque keyed documents. D4b replaces them
// with server-held state.
export const expeditionBlobs = pgTable(
  'expedition_blobs',
  {
    expeditionId: uuid('expedition_id')
      .notNull()
      .references(() => expeditions.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    data: text('data').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.expeditionId, table.key] })],
);
