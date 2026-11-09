import { randomBytes } from 'node:crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  AGGREGATES,
  AGGREGATE_KINDS,
  CONTENT_VERSION,
  upcastAggregate,
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
}

export type LoadedAggregates = { [K in TAggregateKind]?: LoadedAggregate<K> };

export async function createInitialAggregates(exec: Executor, heroId: string): Promise<void> {
  const rows = AGGREGATE_KINDS.map((kind) => ({
    heroId,
    kind,
    revision: 0,
    schemaVersion: AGGREGATES[kind].schemaVersion,
    contentVersion: String(CONTENT_VERSION),
    state: AGGREGATES[kind].createInitial({ heroId }),
    serverState: kind === 'progress' ? { rngSeed: randomBytes(16).toString('hex') } : {},
  }));
  await exec.insert(heroAggregates).values(rows).onConflictDoNothing();
}

function loadOne<K extends TAggregateKind>(
  kind: K,
  row: typeof heroAggregates.$inferSelect,
): LoadedAggregate<K> {
  const state = upcastAggregate(kind, row.schemaVersion, row.state, { heroId: row.heroId });
  if (kind === 'inventory') (state as AggregateStates['inventory']).revision = row.revision;
  return { kind, revision: row.revision, state };
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

/** Locks the rows in the fixed kind order, so two commands can never wait on each other. */
export async function loadAggregatesForUpdate(
  tx: Tx,
  heroId: string,
  kinds: readonly TAggregateKind[],
): Promise<LoadedAggregates> {
  const rows = await tx
    .select()
    .from(heroAggregates)
    .where(and(eq(heroAggregates.heroId, heroId), inArray(heroAggregates.kind, [...kinds])))
    .orderBy(asc(heroAggregates.kind))
    .for('update');
  return toLoaded(rows);
}

export async function loadAggregates(
  exec: Executor,
  heroId: string,
  kinds: readonly TAggregateKind[] = AGGREGATE_KINDS,
): Promise<LoadedAggregates> {
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
  const definition: { project(state: AggregateStates[K]): unknown } = AGGREGATES[kindOf(loaded)];
  return { revision: loaded.revision, state: definition.project(loaded.state) };
}

function kindOf<K extends TAggregateKind>(loaded: LoadedAggregate<K>): K {
  return loaded.kind;
}
