import { and, asc, desc, eq } from 'drizzle-orm';
import { upcastAggregate, type TAggregateKind, AGGREGATES } from '@hexoflat/engine';
import { HEXOBJECT_KEYS, type THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import type { Db } from '../db/db.module';
import {
  aggregateSnapshots,
  commandJournal,
  heroAggregates,
  itemLedger,
  users,
} from '../db/schema';
import type { HeroesService } from '../heroes/heroes.service';
import type { PlayerCommandService } from './player-command.service';

export const SEED_PRESETS = {
  gear: [
    [HEXOBJECT_KEYS.SWORD, 1],
    [HEXOBJECT_KEYS.AXE, 1],
    [HEXOBJECT_KEYS.SHIELD, 1],
    [HEXOBJECT_KEYS.PICKAXE, 1],
  ],
  coins: [[HEXOBJECT_KEYS.COINS, 1000]],
  full: [
    [HEXOBJECT_KEYS.SWORD, 1],
    [HEXOBJECT_KEYS.AXE, 1],
    [HEXOBJECT_KEYS.SHIELD, 1],
    [HEXOBJECT_KEYS.PICKAXE, 1],
    [HEXOBJECT_KEYS.COINS, 1000],
  ],
} as const satisfies Record<string, ReadonlyArray<readonly [THexobjectKey, number]>>;
export type SeedPreset = keyof typeof SEED_PRESETS;

export class AdminToolError extends Error {}

function assertDevOnly(): void {
  if (process.env.NODE_ENV === 'production' && process.env.HEXOFLAT_ADMIN !== '1') {
    throw new AdminToolError('Refusing to run a dev tool in production.');
  }
}

/** Gives a test hero a ready kit. Dev only — a real hero earns everything by playing. */
export async function seedHero(
  db: Db,
  heroes: HeroesService,
  commands: PlayerCommandService,
  login: string,
  preset: SeedPreset = 'full',
): Promise<{ heroId: string; granted: string[] }> {
  assertDevOnly();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.username, login));
  if (!user) throw new AdminToolError(`No account with login "${login}".`);
  const hero = await heroes.findOrCreateByUserId(user.id);
  const granted: string[] = [];
  for (const [key, amount] of SEED_PRESETS[preset]) {
    const result = await commands.grantItem(user.id, hero.id, key, amount, 'dev');
    if (result.result !== 'applied') {
      throw new AdminToolError(`Could not grant ${key}: ${result.code ?? result.result}`);
    }
    granted.push(`${key} x${amount}`);
  }
  return { heroId: hero.id, granted };
}

export async function heroHistory(db: Db, heroId: string, limit = 100) {
  const journal = await db
    .select()
    .from(commandJournal)
    .where(eq(commandJournal.heroId, heroId))
    .orderBy(desc(commandJournal.id))
    .limit(limit);
  const ledger = await db
    .select()
    .from(itemLedger)
    .where(eq(itemLedger.heroId, heroId))
    .orderBy(desc(itemLedger.id))
    .limit(limit);
  return { journal: journal.reverse(), ledger: ledger.reverse() };
}

export interface RollbackPlan {
  kind: TAggregateKind;
  fromRevision: number;
  toRevision: number;
  newRevision: number;
}

/**
 * Restores an aggregate to a stored snapshot. Revisions only ever grow: the restored state is
 * written as the next revision, and what it replaced is kept as a `rollback` snapshot.
 */
export async function rollbackAggregate(
  db: Db,
  heroId: string,
  kind: TAggregateKind,
  revision: number,
  options: { confirm: boolean },
): Promise<RollbackPlan> {
  assertDevOnly();
  if (!(kind in AGGREGATES)) throw new AdminToolError(`Unknown aggregate "${kind}".`);
  return db.transaction(async (tx) => {
    const [snapshot] = await tx
      .select()
      .from(aggregateSnapshots)
      .where(
        and(
          eq(aggregateSnapshots.heroId, heroId),
          eq(aggregateSnapshots.kind, kind),
          eq(aggregateSnapshots.revision, revision),
        ),
      )
      .orderBy(asc(aggregateSnapshots.id))
      .limit(1);
    if (!snapshot) throw new AdminToolError(`No snapshot of ${kind} at revision ${revision}.`);
    const [current] = await tx
      .select()
      .from(heroAggregates)
      .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, kind)))
      .for('update');
    if (!current) throw new AdminToolError(`Hero ${heroId} has no ${kind} aggregate.`);

    const plan: RollbackPlan = {
      kind,
      fromRevision: current.revision,
      toRevision: revision,
      newRevision: current.revision + 1,
    };
    if (!options.confirm) return plan;

    const restored = upcastAggregate(kind, AGGREGATES[kind].schemaVersion, snapshot.state);
    await tx.insert(aggregateSnapshots).values({
      heroId,
      kind,
      revision: current.revision,
      state: current.state,
      reason: 'rollback',
    });
    await tx
      .update(heroAggregates)
      .set({
        state: kind === 'inventory' ? { ...restored, revision: plan.newRevision } : restored,
        revision: plan.newRevision,
        schemaVersion: AGGREGATES[kind].schemaVersion,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, kind)));
    return plan;
  });
}
