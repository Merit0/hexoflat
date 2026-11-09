import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  AGGREGATE_KINDS,
  WORLD_COMMAND_SCHEMAS,
  actWorld,
  createServerWorld,
  deserializeWorld,
  isWorldCommandType,
  serializeWorld,
  serializedWorldSchema,
  stepWorld,
  tickWorld,
  type DomainEvent,
  type ServerWorld,
  type TileDiff,
  type WorldClientHint,
  type WorldEffect,
  type WorldOutcome,
  type WorldPlayerCommand,
  type WorldRun,
} from '@hexoflat/engine';
import type { LocationKey } from '@hexoflat/engine/registry/location-key';
import { DB, type Db } from '../db/db.module';
import { commandJournal, itemLedger } from '../db/schema';
import {
  deleteServerDocument,
  ensureExpedition,
  expeditionSeed,
  lockExpedition,
  readServerDocument,
  writeServerDocument,
} from '../expedition/expedition-store';
import { HeroesService } from '../heroes/heroes.service';
import {
  createInitialAggregates,
  loadAggregatesForUpdate,
  projectAggregate,
  saveAggregate,
  type Tx,
} from '../player/aggregate-store';
import { ledgerEntriesFor } from '../player/item-ledger';
import {
  MAX_COMMAND_BYTES,
  PlayerCommandEnvelopeSchema,
  PlayerCommandError,
  type ProjectedAggregates,
} from '../player/player-command.types';

export interface WorldResponse {
  commandId: string;
  result: 'applied' | 'rejected' | 'conflict';
  code?: string;
  replayed?: boolean;
  events: DomainEvent[];
  tileDiffs: TileDiff[];
  effects: WorldEffect[];
  engagement?: unknown;
  hero: {
    locationKey: string;
    mapId: string;
    coordinates: { columnIndex: number; rowIndex: number } | null;
  } | null;
  aggregates: ProjectedAggregates;
}

const INDEX_KEY = 'srv-index';
const worldKey = (mapId: string) => `srv-world:${mapId}`;

type Index = Partial<Record<LocationKey, string>>;

async function readIndex(tx: Tx, expeditionId: string): Promise<Index> {
  const raw = await readServerDocument(tx, expeditionId, INDEX_KEY);
  return raw ? (JSON.parse(raw) as Index) : {};
}

async function loadWorld(tx: Tx, expeditionId: string, mapId: string, now: number) {
  const raw = await readServerDocument(tx, expeditionId, worldKey(mapId));
  return raw ? deserializeWorld(JSON.parse(raw), now) : null;
}

async function saveWorld(tx: Tx, expeditionId: string, world: ServerWorld): Promise<void> {
  await writeServerDocument(
    tx,
    expeditionId,
    worldKey(world.mapId),
    JSON.stringify(serializeWorld(world)),
  );
}

@Injectable()
export class WorldService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(HeroesService) private readonly heroes: HeroesService,
  ) {}

  async execute(userId: string, raw: unknown): Promise<WorldResponse> {
    if (JSON.stringify(raw ?? null).length > MAX_COMMAND_BYTES) {
      throw new PlayerCommandError('PAYLOAD_TOO_LARGE');
    }
    const envelope = PlayerCommandEnvelopeSchema.safeParse(raw);
    if (!envelope.success) throw new PlayerCommandError('INVALID_ENVELOPE');
    const { commandId, heroId, expectedRevision, command: sent } = envelope.data;
    if (!isWorldCommandType(sent.type)) throw new PlayerCommandError('UNKNOWN_COMMAND');
    const hero = await this.heroes.findOwned(heroId, userId);
    if (!hero) throw new PlayerCommandError('FORBIDDEN');
    const parsed = WORLD_COMMAND_SCHEMAS[sent.type].safeParse(sent);
    if (!parsed.success) throw new PlayerCommandError('INVALID_COMMAND');
    const command = parsed.data;
    if (command.payload.heroId !== heroId) throw new PlayerCommandError('FORBIDDEN');

    return this.db.transaction((tx) =>
      this.run(tx, { userId, heroId, commandId, expectedRevision, command }),
    );
  }

  private async run(
    tx: Tx,
    input: {
      userId: string;
      heroId: string;
      commandId: string;
      expectedRevision: number;
      command: WorldPlayerCommand;
    },
  ): Promise<WorldResponse> {
    const { userId, heroId, commandId, expectedRevision, command } = input;
    await createInitialAggregates(tx, heroId);
    const loaded = await loadAggregatesForUpdate(tx, heroId, AGGREGATE_KINDS);
    const { inventory, progress } = loaded;
    if (!inventory || !progress) throw new Error(`Hero ${heroId} is missing an aggregate`);

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
        tileDiffs: [],
        effects: [],
        hero: null,
        aggregates: {
          inventory: projectAggregate(inventory),
          progress: projectAggregate(progress),
        },
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
        aggregateKind: 'progress',
        commandType: command.type,
        payload: command.payload,
        expectedRevision,
        result,
        reason,
        events,
        newRevision,
      });
    const respond = (
      result: WorldResponse['result'],
      code: string | undefined,
      events: DomainEvent[],
      tileDiffs: TileDiff[],
      world: ServerWorld | null,
      effects: WorldEffect[] = [],
    ): WorldResponse => ({
      commandId,
      result,
      ...(code ? { code } : {}),
      events,
      tileDiffs,
      effects,
      hero: world
        ? { locationKey: world.locationKey, mapId: world.mapId, coordinates: world.heroCoordinates }
        : null,
      aggregates: {
        inventory: projectAggregate(inventory),
        progress: projectAggregate(progress),
      },
    });

    if (progress.revision !== expectedRevision) {
      await journal('conflict', [], 'REVISION_CONFLICT', null);
      return respond('conflict', 'REVISION_CONFLICT', [], [], null);
    }

    const expeditionId = await ensureExpedition(this.db, userId, heroId);
    await lockExpedition(tx, expeditionId);
    const index = await readIndex(tx, expeditionId);
    const now = Date.now();

    let world: ServerWorld | null;
    const progressState = structuredClone(progress.state);
    if (command.type === 'WORLD_ENTER') {
      const { locationKey } = command.payload;
      const known = index[locationKey];
      world = known ? await loadWorld(tx, expeditionId, known, now) : null;
      if (!world) {
        const mapId = randomUUID();
        world = createServerWorld(
          locationKey,
          mapId,
          await expeditionSeed(tx, expeditionId),
          heroId,
        );
        index[locationKey] = mapId;
      }
      progressState.presence = {
        locationKey,
        mapId: world.mapId,
        coordinates: { ...(world.heroCoordinates ?? { columnIndex: 0, rowIndex: 0 }) },
      };
      await saveWorld(tx, expeditionId, world);
      await writeServerDocument(tx, expeditionId, INDEX_KEY, JSON.stringify(index));
      const saved = await saveAggregate(tx, heroId, 'progress', progress.revision, progressState);
      const events: DomainEvent[] = [
        { type: 'WORLD_ENTERED', payload: { heroId, locationKey, mapId: world.mapId } },
      ];
      await journal('applied', events, null, saved);
      return {
        ...respond('applied', undefined, events, [], world),
        aggregates: {
          inventory: projectAggregate(inventory),
          progress: projectAggregate({ kind: 'progress', revision: saved, state: progressState }),
        },
      };
    }

    const presence = progressState.presence;
    world = presence ? await loadWorld(tx, expeditionId, presence.mapId, now) : null;
    if (!world || !presence) {
      await journal('rejected', [], 'NO_WORLD', null);
      return respond('rejected', 'NO_WORLD', [], [], null);
    }

    const run: WorldRun = {
      world,
      progress: progressState,
      inventory: inventory.state,
      heroId,
      now,
      client:
        command.type === 'WORLD_ACTION' || command.type === 'WORLD_TICK'
          ? (command.payload.client as WorldClientHint | undefined)
          : undefined,
    };
    const outcome: WorldOutcome =
      command.type === 'WORLD_STEP'
        ? stepWorld(run, command.payload.target)
        : command.type === 'WORLD_ACTION'
          ? actWorld(run, {
              heroId: command.payload.heroId,
              coordinates: command.payload.coordinates,
              actionType: command.payload.actionType,
              toolKey: command.payload.toolKey,
              now,
            })
          : tickWorld(run);
    if (!outcome.ok) {
      await journal('rejected', outcome.events, outcome.code, null);
      return respond('rejected', outcome.code, outcome.events, [], world);
    }

    const saved = await saveAggregate(tx, heroId, 'progress', progress.revision, outcome.progress);
    const aggregates: ProjectedAggregates = {
      progress: projectAggregate({ kind: 'progress', revision: saved, state: outcome.progress }),
    };
    if (
      outcome.inventory !== inventory.state &&
      JSON.stringify(outcome.inventory) !== JSON.stringify(inventory.state)
    ) {
      const revision = await saveAggregate(
        tx,
        heroId,
        'inventory',
        inventory.revision,
        outcome.inventory,
      );
      aggregates.inventory = projectAggregate({
        kind: 'inventory',
        revision,
        state: outcome.inventory,
      });
      const entries = ledgerEntriesFor(outcome.events, inventory.state);
      if (entries.length > 0) {
        await tx
          .insert(itemLedger)
          .values(entries.map((entry) => ({ heroId, commandId, ...entry })));
      }
    }
    await saveWorld(tx, expeditionId, outcome.world);
    await journal('applied', outcome.events, null, saved);
    return {
      commandId,
      result: 'applied',
      events: outcome.events,
      tileDiffs: outcome.tileDiffs,
      effects: outcome.effects,
      engagement: outcome.world.engagement,
      hero: {
        locationKey: outcome.world.locationKey,
        mapId: outcome.world.mapId,
        coordinates: outcome.world.heroCoordinates,
      },
      aggregates: { inventory: projectAggregate(inventory), ...aggregates },
    };
  }

  async ensure(userId: string, heroId: string, locationKey: LocationKey): Promise<unknown> {
    const hero = await this.heroes.findOwned(heroId, userId);
    if (!hero) throw new PlayerCommandError('FORBIDDEN');
    const expeditionId = await ensureExpedition(this.db, userId, heroId);
    return this.db.transaction(async (tx) => {
      await lockExpedition(tx, expeditionId);
      const index = await readIndex(tx, expeditionId);
      const known = index[locationKey];
      const existing = known ? await readServerDocument(tx, expeditionId, worldKey(known)) : null;
      if (existing) return JSON.parse(existing) as unknown;
      const mapId = randomUUID();
      const created = createServerWorld(
        locationKey,
        mapId,
        await expeditionSeed(tx, expeditionId),
        heroId,
      );
      await saveWorld(tx, expeditionId, created);
      index[locationKey] = mapId;
      await writeServerDocument(tx, expeditionId, INDEX_KEY, JSON.stringify(index));
      return serializeWorld(created);
    });
  }

  async adopt(userId: string, heroId: string, raw: unknown): Promise<ProjectedAggregates> {
    const hero = await this.heroes.findOwned(heroId, userId);
    if (!hero) throw new PlayerCommandError('FORBIDDEN');
    if (process.env.NODE_ENV === 'production' && !hero.isSandbox) {
      throw new PlayerCommandError('FORBIDDEN');
    }
    const parsed = serializedWorldSchema.safeParse(raw);
    if (!parsed.success) throw new PlayerCommandError('INVALID_COMMAND');
    const expeditionId = await ensureExpedition(this.db, userId, heroId);
    return this.db.transaction(async (tx) => {
      await createInitialAggregates(tx, heroId);
      const loaded = await loadAggregatesForUpdate(tx, heroId, ['progress']);
      await lockExpedition(tx, expeditionId);
      const index = await readIndex(tx, expeditionId);
      const { locationKey, mapId } = parsed.data;
      const previous = index[locationKey];
      index[locationKey] = mapId;
      await writeServerDocument(tx, expeditionId, worldKey(mapId), JSON.stringify(parsed.data));
      await writeServerDocument(tx, expeditionId, INDEX_KEY, JSON.stringify(index));
      if (previous && previous !== mapId) {
        await deleteServerDocument(tx, expeditionId, worldKey(previous));
      }
      const progress = loaded.progress;
      if (progress && parsed.data.heroCoordinates && parsed.data.current) {
        const next = structuredClone(progress.state);
        next.presence = {
          locationKey,
          mapId,
          coordinates: { ...parsed.data.heroCoordinates },
        };
        const revision = await saveAggregate(tx, heroId, 'progress', progress.revision, next);
        return { progress: projectAggregate({ kind: 'progress', revision, state: next }) };
      }
      return progress ? { progress: projectAggregate(progress) } : {};
    });
  }

  async snapshot(userId: string, heroId: string): Promise<unknown> {
    const hero = await this.heroes.findOwned(heroId, userId);
    if (!hero) throw new PlayerCommandError('FORBIDDEN');
    const expeditionId = await ensureExpedition(this.db, userId, heroId);
    return this.db.transaction(async (tx) => {
      await createInitialAggregates(tx, heroId);
      const loaded = await loadAggregatesForUpdate(tx, heroId, ['progress']);
      const mapId = loaded.progress?.state.presence?.mapId;
      if (!mapId) return null;
      const raw = await readServerDocument(tx, expeditionId, worldKey(mapId));
      return raw ? (JSON.parse(raw) as unknown) : null;
    });
  }
}
