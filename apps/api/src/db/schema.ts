import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
