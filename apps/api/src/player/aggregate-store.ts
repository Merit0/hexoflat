import { randomBytes } from 'node:crypto';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  AGGREGATES,
  AGGREGATE_KINDS,
  CONTENT_VERSION,
  upcastAggregate,
  type AggregateServerState,
  type AggregateStates,
  type TAggregateKind,
} from '@hexoflat/engine';
import type { Db } from '../db/db.module';
import { aggregateSnapshots, heroAggregates } from '../db/schema';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type Executor = Db | Tx;

export const SNAPSHOT_EVERY_REVISIONS = 50;

export interface LoadedAggregate<K extends TAggregateKind = TAggregateKind> {
  kind: K;
  revision: number;
  state: AggregateStates[K];
  serverState: AggregateServerState;
}

export type LoadedAggregates = { [K in TAggregateKind]?: LoadedAggregate<K> };

function newRngSeed(): string {
  return randomBytes(16).toString('hex');
}

export async function createInitialAggregates(exec: Executor, heroId: string): Promise<void> {
  const rows = AGGREGATE_KINDS.map((kind) => ({
    heroId,
    kind,
    revision: 0,
    schemaVersion: AGGREGATES[kind].schemaVersion,
    contentVersion: String(CONTENT_VERSION),
    state: AGGREGATES[kind].createInitial({ heroId }),
    serverState: kind === 'progress' ? { rngSeed: newRngSeed() } : {},
  }));
  await exec.insert(heroAggregates).values(rows).onConflictDoNothing();
}

async function ensureRngSeed(
  exec: Executor,
  heroId: string,
  kinds: readonly TAggregateKind[],
): Promise<void> {
  if (!kinds.includes('progress')) return;
  const seed = JSON.stringify({ rngSeed: newRngSeed() });
  await exec
    .update(heroAggregates)
    .set({
      serverState: sql`coalesce(${heroAggregates.serverState}, '{}'::jsonb) || ${seed}::jsonb`,
    })
    .where(
      and(
        eq(heroAggregates.heroId, heroId),
        eq(heroAggregates.kind, 'progress'),
        sql`coalesce(${heroAggregates.serverState}->>'rngSeed', '') = ''`,
      ),
    );
}

const serverStateSchema = z.object({ rngSeed: z.string().min(1).optional() });

function serverStateOf(raw: unknown): AggregateServerState {
  const parsed = serverStateSchema.safeParse(raw ?? {});
  return parsed.success && parsed.data.rngSeed ? { rngSeed: parsed.data.rngSeed } : {};
}

function loadOne<K extends TAggregateKind>(
  kind: K,
  row: typeof heroAggregates.$inferSelect,
): LoadedAggregate<K> {
  const state = upcastAggregate(kind, row.schemaVersion, row.state, { heroId: row.heroId });
  if (kind === 'inventory') (state as AggregateStates['inventory']).revision = row.revision;
  return { kind, revision: row.revision, state, serverState: serverStateOf(row.serverState) };
}

function toLoaded(rows: readonly (typeof heroAggregates.$inferSelect)[]): LoadedAggregates {
  const loaded: LoadedAggregates = {};
  for (const row of rows) {
    const kind = row.kind as TAggregateKind;
    if (!(kind in AGGREGATES)) continue;
    Object.assign(loaded, { [kind]: loadOne(kind, row) });
  }
  return loaded;
}

function lockOrder() {
  return sql`case ${heroAggregates.kind} when 'progress' then 0 when 'inventory' then 1 else 2 end`;
}

export async function loadAggregatesForUpdate(
  tx: Tx,
  heroId: string,
  kinds: readonly TAggregateKind[],
): Promise<LoadedAggregates> {
  await ensureRngSeed(tx, heroId, kinds);
  const rows = await tx
    .select()
    .from(heroAggregates)
    .where(and(eq(heroAggregates.heroId, heroId), inArray(heroAggregates.kind, [...kinds])))
    .orderBy(lockOrder())
    .for('update');
  return toLoaded(rows);
}

export async function loadAggregates(
  exec: Executor,
  heroId: string,
  kinds: readonly TAggregateKind[] = AGGREGATE_KINDS,
): Promise<LoadedAggregates> {
  await ensureRngSeed(exec, heroId, kinds);
  const rows = await exec
    .select()
    .from(heroAggregates)
    .where(and(eq(heroAggregates.heroId, heroId), inArray(heroAggregates.kind, [...kinds])))
    .orderBy(asc(heroAggregates.kind));
  return toLoaded(rows);
}

export class RevisionConflictError extends Error {
  constructor(readonly kind: TAggregateKind) {
    super(`Revision conflict on ${kind}`);
  }
}

export async function saveAggregate<K extends TAggregateKind>(
  tx: Tx,
  heroId: string,
  kind: K,
  expectedRevision: number,
  state: AggregateStates[K],
): Promise<number> {
  const revision = expectedRevision + 1;
  const updated = await tx
    .update(heroAggregates)
    .set({
      state,
      revision,
      schemaVersion: AGGREGATES[kind].schemaVersion,
      contentVersion: String(CONTENT_VERSION),
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(heroAggregates.heroId, heroId),
        eq(heroAggregates.kind, kind),
        eq(heroAggregates.revision, expectedRevision),
      ),
    )
    .returning({ revision: heroAggregates.revision });
  if (updated.length === 0) throw new RevisionConflictError(kind);
  if (revision % SNAPSHOT_EVERY_REVISIONS === 0) {
    await tx
      .insert(aggregateSnapshots)
      .values({ heroId, kind, revision, state, reason: 'periodic' });
  }
  return revision;
}

export function projectAggregate<K extends TAggregateKind>(
  loaded: LoadedAggregate<K>,
): { revision: number; state: unknown } {
  const definition: {
    project(state: AggregateStates[K], server: AggregateServerState): unknown;
  } = AGGREGATES[kindOf(loaded)];
  return {
    revision: loaded.revision,
    state: definition.project(loaded.state, loaded.serverState),
  };
}

function kindOf<K extends TAggregateKind>(loaded: LoadedAggregate<K>): K {
  return loaded.kind;
}
