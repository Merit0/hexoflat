import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  AGGREGATES,
  AGGREGATE_KINDS,
  PLAYER_COMMAND_AGGREGATES,
  PLAYER_COMMAND_SCHEMAS,
  consumeItemServerSide,
  emptyProgressState,
  executePlayerCommand,
  grantItemServerSide,
  isPlayerCommandType,
  replaceInventory,
  type DomainEvent,
  type PlayerAggregates,
  type PlayerCommandOutcome,
  type TAggregateKind,
} from '@hexoflat/engine';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { DB, type Db } from '../db/db.module';
import { commandJournal, itemLedger } from '../db/schema';
import { HeroesService } from '../heroes/heroes.service';
import {
  createInitialAggregates,
  loadAggregates,
  loadAggregatesForUpdate,
  projectAggregate,
  saveAggregate,
  type LoadedAggregates,
  type Tx,
} from './aggregate-store';
import { ledgerEntriesFor } from './item-ledger';
import {
  MAX_COMMAND_BYTES,
  PlayerCommandEnvelopeSchema,
  PlayerCommandError,
  type HeroSnapshot,
  type PlayerCommandResponse,
  type ProjectedAggregates,
} from './player-command.types';

interface LockedRun {
  userId: string;
  heroId: string;
  commandId: string;
  commandType: string;
  payload: unknown;
  aggregateKind: TAggregateKind;
  expectedRevision: number | null;
  kinds: readonly TAggregateKind[];
  run: (aggregates: PlayerAggregates) => PlayerCommandOutcome;
}

function projectAll(loaded: LoadedAggregates): ProjectedAggregates {
  const projected: ProjectedAggregates = {};
  for (const kind of Object.keys(loaded) as TAggregateKind[]) {
    const entry = loaded[kind];
    if (entry) Object.assign(projected, { [kind]: projectAggregate(entry) });
  }
  return projected;
}

function asAggregates(loaded: LoadedAggregates): PlayerAggregates {
  if (!loaded.inventory) throw new Error('Hero has no inventory aggregate');
  return {
    inventory: loaded.inventory.state,
    progress: loaded.progress?.state ?? emptyProgressState(),
  };
}

@Injectable()
export class PlayerCommandService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(HeroesService) private readonly heroes: HeroesService,
  ) {}

  async snapshot(userId: string, heroId: string): Promise<HeroSnapshot> {
    const hero = await this.heroes.findOwned(heroId, userId);
    if (!hero) throw new PlayerCommandError('FORBIDDEN');
    await createInitialAggregates(this.db, heroId);
    return { heroId, aggregates: projectAll(await loadAggregates(this.db, heroId)) };
  }

  async execute(userId: string, raw: unknown): Promise<PlayerCommandResponse> {
    if (JSON.stringify(raw ?? null).length > MAX_COMMAND_BYTES) {
      throw new PlayerCommandError('PAYLOAD_TOO_LARGE');
    }
    const envelope = PlayerCommandEnvelopeSchema.safeParse(raw);
    if (!envelope.success) throw new PlayerCommandError('INVALID_ENVELOPE');
    const { commandId, heroId, aggregate, expectedRevision, command: sent } = envelope.data;

    if (!isPlayerCommandType(sent.type)) throw new PlayerCommandError('UNKNOWN_COMMAND');
    const hero = await this.heroes.findOwned(heroId, userId);
    if (!hero) throw new PlayerCommandError('FORBIDDEN');

    const parsed = PLAYER_COMMAND_SCHEMAS[sent.type].safeParse(sent);
    if (!parsed.success) throw new PlayerCommandError('INVALID_COMMAND');
    const command = parsed.data;
    const kinds = PLAYER_COMMAND_AGGREGATES[command.type];
    if (command.payload.heroId !== heroId) throw new PlayerCommandError('FORBIDDEN');
    if (aggregate !== kinds[0]) throw new PlayerCommandError('AGGREGATE_MISMATCH');
    if (command.payload.revision !== expectedRevision) {
      throw new PlayerCommandError('INVALID_COMMAND');
    }

    const devGrantAllowed = process.env.NODE_ENV !== 'production' || hero.isSandbox;
    return this.db.transaction((tx) =>
      this.runLocked(tx, {
        userId,
        heroId,
        commandId,
        commandType: command.type,
        payload: command.payload,
        aggregateKind: aggregate,
        expectedRevision,
        kinds,
        run: (aggregates) =>
          executePlayerCommand(aggregates, command, {
            devGrantAllowed,
            inventory: { stashOpen: true, battleOpen: false },
          }),
      }),
    );
  }

  /**
   * Dev and sandbox only: puts the hero back to a brand-new state (empty bag, no chest, no claimed
   * reward). Revisions keep growing, and the removed items are written off in the ledger.
   */
  async resetHero(userId: string, heroId: string): Promise<HeroSnapshot> {
    const hero = await this.heroes.findOwned(heroId, userId);
    if (!hero) throw new PlayerCommandError('FORBIDDEN');
    if (process.env.NODE_ENV === 'production' && !hero.isSandbox) {
      throw new PlayerCommandError('FORBIDDEN');
    }
    await this.db.transaction(async (tx) => {
      await createInitialAggregates(tx, heroId);
      const loaded = await loadAggregatesForUpdate(tx, heroId, AGGREGATE_KINDS);
      const inventory = loaded.inventory;
      if (!inventory) throw new Error(`Hero ${heroId} has no inventory aggregate`);
      const replaced = replaceInventory(inventory.state, {
        heroId,
        revision: inventory.state.revision,
        inventory: AGGREGATES.inventory.createInitial({ heroId }),
      });
      const events = replaced.events;
      for (const kind of AGGREGATE_KINDS) {
        const before = loaded[kind];
        if (!before) continue;
        const fresh =
          kind === 'inventory'
            ? { ...(replaced.inventory as InventoryState), revision: before.revision + 1 }
            : AGGREGATES[kind].createInitial({ heroId });
        await saveAggregate(tx, heroId, kind, before.revision, fresh as never);
      }
      await tx.insert(commandJournal).values({
        commandId: randomUUID(),
        userId,
        heroId,
        aggregateKind: 'inventory',
        commandType: 'DEV_RESET_HERO',
        payload: {},
        expectedRevision: null,
        result: 'applied',
        reason: null,
        events,
        newRevision: inventory.revision + 1,
      });
      const entries = ledgerEntriesFor(events, inventory.state);
      if (entries.length > 0) {
        await tx.insert(itemLedger).values(
          entries.map((entry) => ({
            heroId,
            commandId: randomUUID(),
            ...entry,
            reason: 'dev_reset',
          })),
        );
      }
    });
    return this.snapshot(userId, heroId);
  }

  /** For server code that spends items on the hero's behalf (a purchase, a world action). */
  async consumeItem(
    userId: string,
    heroId: string,
    key: THexobjectKey,
    amount: number,
    commandId: string = randomUUID(),
  ): Promise<PlayerCommandResponse> {
    return this.serverStock(userId, heroId, commandId, 'CONSUME_ITEM', { key, amount }, (a) =>
      consumeItemServerSide(a.inventory, key, amount),
    );
  }

  /** For server code that hands items to the hero (a reward, a loot pickup). */
  async grantItem(
    userId: string,
    heroId: string,
    key: THexobjectKey,
    amount: number,
    source: 'pickup' | 'loot' | 'reward' | 'dev',
    commandId: string = randomUUID(),
  ): Promise<PlayerCommandResponse> {
    return this.serverStock(userId, heroId, commandId, 'GRANT_ITEM', { key, amount, source }, (a) =>
      grantItemServerSide(a.inventory, key, amount, source),
    );
  }

  private serverStock(
    userId: string,
    heroId: string,
    commandId: string,
    commandType: string,
    payload: unknown,
    run: (aggregates: PlayerAggregates) => PlayerCommandOutcome,
  ): Promise<PlayerCommandResponse> {
    return this.db.transaction((tx) =>
      this.runLocked(tx, {
        userId,
        heroId,
        commandId,
        commandType,
        payload,
        aggregateKind: 'inventory',
        expectedRevision: null,
        kinds: ['inventory'],
        run,
      }),
    );
  }

  private async runLocked(tx: Tx, input: LockedRun): Promise<PlayerCommandResponse> {
    const { userId, heroId, commandId, kinds } = input;
    await createInitialAggregates(tx, heroId);
    const loaded = await loadAggregatesForUpdate(tx, heroId, kinds);

    const [prior] = await tx
      .select()
      .from(commandJournal)
      .where(eq(commandJournal.commandId, commandId))
      .limit(1);
    if (prior) {
      if (prior.heroId !== heroId || prior.userId !== userId) {
        throw new PlayerCommandError('FORBIDDEN');
      }
      return {
        commandId,
        result: prior.result,
        ...(prior.reason ? { code: prior.reason } : {}),
        replayed: true,
        events: prior.events as DomainEvent[],
        aggregates: projectAll(loaded),
      };
    }

    const journal = (
      result: 'applied' | 'rejected' | 'conflict',
      events: DomainEvent[],
      reason: string | null,
      newRevision: number | null,
    ) =>
      tx.insert(commandJournal).values({
        commandId,
        userId,
        heroId,
        aggregateKind: input.aggregateKind,
        commandType: input.commandType,
        payload: input.payload,
        expectedRevision: input.expectedRevision,
        result,
        reason,
        events,
        newRevision,
      });

    const primary = loaded[input.aggregateKind];
    if (!primary) throw new Error(`Hero ${heroId} has no ${input.aggregateKind} aggregate`);
    if (input.expectedRevision !== null && primary.revision !== input.expectedRevision) {
      await journal('conflict', [], 'REVISION_CONFLICT', null);
      return {
        commandId,
        result: 'conflict',
        code: 'REVISION_CONFLICT',
        events: [],
        aggregates: projectAll(loaded),
      };
    }

    const outcome = input.run(asAggregates(loaded));
    if (!outcome.ok) {
      await journal('rejected', outcome.events, outcome.code, null);
      return {
        commandId,
        result: 'rejected',
        code: outcome.code,
        events: outcome.events,
        aggregates: projectAll(loaded),
      };
    }

    const changedKinds = (Object.keys(outcome.changed) as TAggregateKind[]).filter(
      (kind) => outcome.changed[kind] !== undefined,
    );
    const aggregates: ProjectedAggregates = {};
    for (const kind of changedKinds) {
      const before = loaded[kind];
      if (!before) throw new Error(`Hero ${heroId} has no ${kind} aggregate`);
      const revision = await saveAggregate(
        tx,
        heroId,
        kind,
        before.revision,
        outcome.changed[kind] as never,
      );
      Object.assign(aggregates, {
        [kind]: projectAggregate({ kind, revision, state: outcome.changed[kind] as never }),
      });
    }

    if (outcome.changed.inventory && loaded.inventory) {
      const entries = ledgerEntriesFor(outcome.events, loaded.inventory.state);
      if (entries.length > 0) {
        await tx
          .insert(itemLedger)
          .values(entries.map((entry) => ({ heroId, commandId, ...entry })));
      }
    }

    const primaryAfter = aggregates[input.aggregateKind];
    await journal('applied', outcome.events, null, primaryAfter?.revision ?? primary.revision);
    return { commandId, result: 'applied', events: outcome.events, aggregates };
  }
}
