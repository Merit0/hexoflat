import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  AGGREGATE_KINDS,
  WORLD_COMMAND_SCHEMAS,
  actWorld,
  battleWorld,
  createServerWorld,
  deserializeWorld,
  isWorldCommandType,
  projectDiffsForClient,
  projectWorldForClient,
  serializeWorld,
  serializedWorldSchema,
  stepWorld,
  tickWorld,
  type BattleStep,
  type BattleWorldOutcome,
  type DomainEvent,
  type ServerWorld,
  type TileDiff,
  type WorldClientHint,
  type PortalRun,
  type TravelRun,
  type WorldEffect,
  type WorldOutcome,
  type WorldPlayerCommand,
  type WorldRun,
  closePortalWorld,
  enterPortalWorld,
  openPortalWorld,
  travelWorld,
} from '@hexoflat/engine';
import type { LocationKey } from '@hexoflat/engine/registry/location-key';
import { projectBattleForViewer } from '@hexoflat/engine/battle/projection';
import { applyBattleFixture, battleFixtureSchema } from '@hexoflat/engine/battle/battle-fixtures';
import { applyWorldFixture, worldFixtureSchema } from '@hexoflat/engine/world/world-fixtures';
import { e2eFixturesEnabled } from '../common/e2e-fixtures';
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
  type LoadedAggregate,
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
  touched?: { locationKey: LocationKey; world: unknown }[];
  travel?: {
    locationKey: LocationKey;
    world: unknown;
    refreshed: { locationKey: LocationKey; world: unknown } | null;
  };
  engagement?: unknown;
  steps?: BattleStep[];
  serverNowMs?: number;
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

function clientWorld(world: ServerWorld) {
  return projectWorldForClient(serializeWorld(world));
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

    const expeditionId = await ensureExpedition(this.db, userId, heroId);
    return this.db.transaction((tx) =>
      this.run(tx, { userId, heroId, commandId, expectedRevision, command, expeditionId }),
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
      expeditionId: string;
    },
  ): Promise<WorldResponse> {
    const { userId, heroId, commandId, expectedRevision, command, expeditionId } = input;
    await lockExpedition(tx, expeditionId);
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
    const needsFinders =
      command.type === 'WORLD_TRAVEL' ||
      command.type === 'WORLD_PORTAL_ENTER' ||
      command.type === 'WORLD_PORTAL_CLOSE' ||
      (command.type === 'WORLD_BATTLE' && command.payload.kind === 'close');
    const stored: Partial<Record<LocationKey, ServerWorld>> = {};
    const byMap = new Map<string, ServerWorld>();
    if (needsFinders) {
      for (const [key, mapId] of Object.entries(index) as [LocationKey, string][]) {
        const held = mapId === world.mapId ? null : await loadWorld(tx, expeditionId, mapId, now);
        if (held) {
          stored[key] = held;
          byMap.set(mapId, held);
        }
      }
    }
    const seed = needsFinders ? await expeditionSeed(tx, expeditionId) : '';
    const finders = {
      loadStored: (key: LocationKey) => stored[key] ?? null,
      loadById: (mapId: string) => byMap.get(mapId) ?? null,
      create: (key: LocationKey) => createServerWorld(key, randomUUID(), seed, heroId),
    };
    if (command.type === 'WORLD_TRAVEL' || command.type === 'WORLD_PORTAL_ENTER') {
      const travelRun: TravelRun & PortalRun = { ...run, ...finders };
      const travelled =
        command.type === 'WORLD_TRAVEL'
          ? travelWorld(travelRun, command.payload.via)
          : enterPortalWorld(travelRun);
      if (!travelled.ok) {
        await journal('rejected', travelled.events, travelled.code, null);
        return respond('rejected', travelled.code, travelled.events, [], world, travelled.effects);
      }
      const { origin, destination, replaced, touched } = travelled;
      for (const other of touched) await saveWorld(tx, expeditionId, other);
      if (replaced) {
        await deleteServerDocument(tx, expeditionId, worldKey(origin.mapId));
        await saveWorld(tx, expeditionId, replaced);
        index[replaced.locationKey] = replaced.mapId;
      } else {
        await saveWorld(tx, expeditionId, origin);
      }
      await saveWorld(tx, expeditionId, destination);
      index[destination.locationKey] = destination.mapId;
      await writeServerDocument(tx, expeditionId, INDEX_KEY, JSON.stringify(index));
      const savedProgress = await saveAggregate(
        tx,
        heroId,
        'progress',
        progress.revision,
        travelled.progress,
      );
      const travelAggregates: ProjectedAggregates = {
        progress: projectAggregate({
          kind: 'progress',
          revision: savedProgress,
          state: travelled.progress,
        }),
      };
      if (JSON.stringify(travelled.inventory) !== JSON.stringify(inventory.state)) {
        const revision = await saveAggregate(
          tx,
          heroId,
          'inventory',
          inventory.revision,
          travelled.inventory,
        );
        travelAggregates.inventory = projectAggregate({
          kind: 'inventory',
          revision,
          state: travelled.inventory,
        });
      }
      await journal('applied', travelled.events, null, savedProgress);
      return {
        ...respond('applied', undefined, travelled.events, [], destination, travelled.effects),
        touched: [...(replaced ? [] : [origin]), ...touched].map((other) => ({
          locationKey: other.locationKey,
          world: clientWorld(other),
        })),
        travel: {
          locationKey: destination.locationKey,
          world: clientWorld(destination),
          refreshed: replaced
            ? { locationKey: replaced.locationKey, world: clientWorld(replaced) }
            : null,
        },
        aggregates: { inventory: projectAggregate(inventory), ...travelAggregates },
      };
    }
    if (command.type === 'WORLD_BATTLE') {
      const fought = battleWorld({ ...run, ...finders }, command.payload);
      if (!fought.ok) {
        await journal('rejected', fought.events, fought.code, null);
        return respond('rejected', fought.code, fought.events, [], world);
      }
      const committed = await this.commitBattle(tx, {
        expeditionId,
        heroId,
        commandId,
        index,
        progress,
        inventory,
        fought,
      });
      await journal('applied', fought.events, null, committed.progressRevision);
      return { commandId, ...committed.response };
    }
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
          : command.type === 'WORLD_PORTAL_OPEN'
            ? openPortalWorld(run, command.payload.target)
            : command.type === 'WORLD_PORTAL_CLOSE'
              ? closePortalWorld({ ...run, ...finders })
              : tickWorld(run);
    if (!outcome.ok) {
      await journal('rejected', outcome.events, outcome.code, null);
      return respond('rejected', outcome.code, outcome.events, [], world, outcome.effects);
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
    for (const other of outcome.touched ?? []) await saveWorld(tx, expeditionId, other);
    await journal('applied', outcome.events, null, saved);
    return {
      commandId,
      result: 'applied',
      events: outcome.events,
      tileDiffs: projectDiffsForClient(outcome.tileDiffs),
      effects: outcome.effects,
      touched: (outcome.touched ?? []).map((other) => ({
        locationKey: other.locationKey,
        world: clientWorld(other),
      })),
      engagement: outcome.world.engagement,
      hero: {
        locationKey: outcome.world.locationKey,
        mapId: outcome.world.mapId,
        coordinates: outcome.world.heroCoordinates,
      },
      aggregates: { inventory: projectAggregate(inventory), ...aggregates },
    };
  }

  private async commitBattle(
    tx: Tx,
    input: {
      expeditionId: string;
      heroId: string;
      commandId: string | null;
      index: Index;
      progress: LoadedAggregate<'progress'>;
      inventory: LoadedAggregate<'inventory'>;
      fought: Extract<BattleWorldOutcome, { ok: true }>;
    },
  ): Promise<{ progressRevision: number; response: Omit<WorldResponse, 'commandId'> }> {
    const { expeditionId, heroId, commandId, index, progress, inventory, fought } = input;
    const progressRevision = await saveAggregate(
      tx,
      heroId,
      'progress',
      progress.revision,
      fought.progress,
    );
    const aggregates: ProjectedAggregates = {
      progress: projectAggregate({
        kind: 'progress',
        revision: progressRevision,
        state: fought.progress,
      }),
    };
    const inventoryChanged = JSON.stringify(fought.inventory) !== JSON.stringify(inventory.state);
    if (inventoryChanged) {
      const revision = await saveAggregate(
        tx,
        heroId,
        'inventory',
        inventory.revision,
        fought.inventory,
      );
      aggregates.inventory = projectAggregate({
        kind: 'inventory',
        revision,
        state: fought.inventory,
      });
      const entries = ledgerEntriesFor(fought.events, inventory.state);
      if (commandId && entries.length > 0) {
        await tx
          .insert(itemLedger)
          .values(entries.map((entry) => ({ heroId, commandId, ...entry })));
      }
    } else {
      aggregates.inventory = projectAggregate(inventory);
    }

    const { respawn } = fought;
    let current = fought.world;
    const touched: ServerWorld[] = [];
    if (respawn) {
      for (const other of respawn.touched) await saveWorld(tx, expeditionId, other);
      if (respawn.replaced) {
        await deleteServerDocument(tx, expeditionId, worldKey(respawn.origin.mapId));
        await saveWorld(tx, expeditionId, respawn.replaced);
        index[respawn.replaced.locationKey] = respawn.replaced.mapId;
      } else {
        await saveWorld(tx, expeditionId, respawn.origin);
        touched.push(respawn.origin);
      }
      await saveWorld(tx, expeditionId, respawn.destination);
      index[respawn.destination.locationKey] = respawn.destination.mapId;
      await writeServerDocument(tx, expeditionId, INDEX_KEY, JSON.stringify(index));
      touched.push(...respawn.touched);
      current = respawn.destination;
    } else {
      await saveWorld(tx, expeditionId, fought.world);
    }
    return {
      progressRevision,
      response: {
        result: 'applied',
        ...(fought.rejected ? { code: fought.rejected } : {}),
        events: fought.events,
        tileDiffs: projectDiffsForClient(fought.tileDiffs),
        effects: [],
        steps: fought.steps,
        serverNowMs: fought.serverNowMs,
        engagement: fought.world.engagement,
        touched: touched.map((other) => ({
          locationKey: other.locationKey,
          world: clientWorld(other),
        })),
        ...(respawn
          ? {
              travel: {
                locationKey: respawn.destination.locationKey,
                world: clientWorld(respawn.destination),
                refreshed: respawn.replaced
                  ? {
                      locationKey: respawn.replaced.locationKey,
                      world: clientWorld(respawn.replaced),
                    }
                  : null,
              },
            }
          : {}),
        hero: {
          locationKey: current.locationKey,
          mapId: current.mapId,
          coordinates: current.heroCoordinates,
        },
        aggregates,
      },
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
      if (existing) {
        return projectWorldForClient(serializedWorldSchema.parse(JSON.parse(existing)));
      }
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
      return clientWorld(created);
    });
  }

  async settleDefeat(userId: string, heroId: string): Promise<void> {
    const hero = await this.heroes.findOwned(heroId, userId);
    if (!hero) throw new PlayerCommandError('FORBIDDEN');
    const expeditionId = await ensureExpedition(this.db, userId, heroId);
    await this.db.transaction(async (tx) => {
      await lockExpedition(tx, expeditionId);
      await createInitialAggregates(tx, heroId);
      const { progress, inventory } = await loadAggregatesForUpdate(tx, heroId, AGGREGATE_KINDS);
      const mapId = progress?.state.presence?.mapId;
      if (!progress || !inventory || !mapId) return;
      const now = Date.now();
      const world = await loadWorld(tx, expeditionId, mapId, now);
      if (world?.battle?.phase !== 'ended' || world.battle.outcome !== 'defeat') return;
      const index = await readIndex(tx, expeditionId);
      const stored: Partial<Record<LocationKey, ServerWorld>> = {};
      const byMap = new Map<string, ServerWorld>();
      for (const [key, otherId] of Object.entries(index) as [LocationKey, string][]) {
        const held =
          otherId === world.mapId ? null : await loadWorld(tx, expeditionId, otherId, now);
        if (held) {
          stored[key] = held;
          byMap.set(otherId, held);
        }
      }
      const seed = await expeditionSeed(tx, expeditionId);
      const fought = battleWorld(
        {
          world,
          progress: structuredClone(progress.state),
          inventory: structuredClone(inventory.state),
          heroId,
          now,
          loadStored: (key: LocationKey) => stored[key] ?? null,
          loadById: (id: string) => byMap.get(id) ?? null,
          create: (key: LocationKey) => createServerWorld(key, randomUUID(), seed, heroId),
        },
        { kind: 'close', heroId },
      );
      if (!fought.ok) return;
      await this.commitBattle(tx, {
        expeditionId,
        heroId,
        commandId: null,
        index,
        progress,
        inventory,
        fought,
      });
    });
  }

  async snapshot(userId: string, heroId: string): Promise<unknown> {
    const hero = await this.heroes.findOwned(heroId, userId);
    if (!hero) throw new PlayerCommandError('FORBIDDEN');
    const expeditionId = await ensureExpedition(this.db, userId, heroId);
    return this.db.transaction(async (tx) => {
      await lockExpedition(tx, expeditionId);
      await createInitialAggregates(tx, heroId);
      const loaded = await loadAggregatesForUpdate(tx, heroId, AGGREGATE_KINDS);
      const { progress, inventory } = loaded;
      const mapId = progress?.state.presence?.mapId;
      if (!progress || !inventory || !mapId) return null;
      const now = Date.now();
      let world = await loadWorld(tx, expeditionId, mapId, now);
      if (!world) return null;
      if (world.battle) {
        const settled = battleWorld(
          {
            world,
            progress: structuredClone(progress.state),
            inventory: structuredClone(inventory.state),
            heroId,
            now,
            loadStored: () => null,
            loadById: () => null,
            create: () => {
              throw new Error('A settle never builds a map');
            },
          },
          { kind: 'sync', heroId },
        );
        if (settled.ok) {
          await this.commitBattle(tx, {
            expeditionId,
            heroId,
            commandId: null,
            index: await readIndex(tx, expeditionId),
            progress,
            inventory,
            fought: settled,
          });
          world = settled.world;
        }
      }
      return {
        ...clientWorld(world),
        battleView: world.battle ? projectBattleForViewer(world.battle, 'heroes') : null,
        serverNowMs: now,
      };
    });
  }

  async battleFixture(userId: string, heroId: string, raw: unknown): Promise<unknown> {
    if (!e2eFixturesEnabled()) throw new PlayerCommandError('FORBIDDEN');
    const fixture = battleFixtureSchema.safeParse(raw);
    if (!fixture.success) throw new PlayerCommandError('INVALID_COMMAND');
    const hero = await this.heroes.findOwned(heroId, userId);
    if (!hero) throw new PlayerCommandError('FORBIDDEN');
    const expeditionId = await ensureExpedition(this.db, userId, heroId);
    return this.db.transaction(async (tx) => {
      await lockExpedition(tx, expeditionId);
      const { progress } = await loadAggregatesForUpdate(tx, heroId, ['progress']);
      const mapId = progress?.state.presence?.mapId;
      const now = Date.now();
      const world = mapId ? await loadWorld(tx, expeditionId, mapId, now) : null;
      if (!world?.battle) throw new PlayerCommandError('INVALID_COMMAND');
      world.battle = applyBattleFixture(world.battle, fixture.data);
      world.battle.turnClockMs = now;
      await saveWorld(tx, expeditionId, world);
      return { battleView: projectBattleForViewer(world.battle, 'heroes'), serverNowMs: now };
    });
  }

  async worldFixture(userId: string, heroId: string, raw: unknown): Promise<unknown> {
    if (!e2eFixturesEnabled()) throw new PlayerCommandError('FORBIDDEN');
    const fixture = worldFixtureSchema.safeParse(raw);
    if (!fixture.success) throw new PlayerCommandError('INVALID_COMMAND');
    const hero = await this.heroes.findOwned(heroId, userId);
    if (!hero) throw new PlayerCommandError('FORBIDDEN');
    const expeditionId = await ensureExpedition(this.db, userId, heroId);
    return this.db.transaction(async (tx) => {
      await lockExpedition(tx, expeditionId);
      const { progress } = await loadAggregatesForUpdate(tx, heroId, ['progress']);
      const mapId = progress?.state.presence?.mapId;
      const world = mapId ? await loadWorld(tx, expeditionId, mapId, Date.now()) : null;
      if (!world || world.battle) throw new PlayerCommandError('INVALID_COMMAND');
      const placed = applyWorldFixture(world, fixture.data);
      if (!placed) throw new PlayerCommandError('INVALID_COMMAND');
      await saveWorld(tx, expeditionId, world);
      return placed;
    });
  }
}
