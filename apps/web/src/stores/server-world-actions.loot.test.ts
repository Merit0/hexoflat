import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { emptyInventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { emptyProgressState } from '@hexoflat/engine/aggregates/progress-state';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { coordinateKey, getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { actWorld, type WorldRun } from '@hexoflat/engine/world/world-commands';
import {
  createServerWorld,
  deserializeWorld,
  serializeWorld,
  type ServerWorld,
} from '@hexoflat/engine/world/server-world';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { WorldCommandResult } from '@/services/inventory/inventory-sync';
import { finishLootFlights, lootFlightRequest } from '@/services/loot/loot-flight-state';
import { applyWorldResultAction, type ServerWorldHost } from './server-world-actions';

const HERO_ID = 'hero-1';

function sceneWorld(): ServerWorld {
  return createServerWorld('camping', 'map-client', 'client-seed', HERO_ID);
}

function tileAt(world: ServerWorld, at: IHexCoordinates) {
  const tile = world.map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(at));
  if (!tile) throw new Error('no tile');
  return tile;
}

function freeAround(world: ServerWorld, at: IHexCoordinates): IHexCoordinates {
  const spot = getHexNeighbors(at).find((coord) => {
    const tile = world.map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(coord));
    return !!tile && !tile.hexobject && tile.terrain === 'ground';
  });
  if (!spot) throw new Error('no free neighbour');
  return spot;
}

function copyOf(world: ServerWorld): ServerWorld {
  return deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(world))), 0);
}

function runOn(world: ServerWorld): WorldRun {
  return {
    world,
    progress: emptyProgressState(HERO_ID),
    inventory: emptyInventoryState(HERO_ID),
    heroId: HERO_ID,
    now: 1_000,
  };
}

function resultOf(outcome: ReturnType<typeof actWorld>): WorldCommandResult {
  if (!outcome.ok) throw new Error(outcome.code);
  return {
    ok: true,
    tileDiffs: outcome.tileDiffs,
    events: outcome.events,
    effects: outcome.effects,
    engagement: null,
    steps: [],
    serverNowMs: null,
  };
}

function bareResult(
  events: WorldCommandResult['events'],
  extra: Partial<WorldCommandResult> = {},
): WorldCommandResult {
  return {
    ok: true,
    tileDiffs: [],
    events,
    effects: [],
    engagement: null,
    steps: [],
    serverNowMs: null,
    ...extra,
  };
}

function hostOf(map: ServerWorld['map']) {
  const markTilesDirty = vi.fn();
  const refetchWorld = vi.fn(async () => {});
  const host: ServerWorldHost = {
    map,
    currentMapId: 'map-client',
    currentLocationKey: 'camping',
    getTileAt: (at) =>
      map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(at)) ?? null,
    markTilesDirty,
    cacheServedWorld: vi.fn(),
    refetchWorld,
  };
  return { host, markTilesDirty, refetchWorld };
}

function heroAt(coordinates: IHexCoordinates) {
  return { heroCoordinates: { ...coordinates }, hero: { name: 'Test' } };
}

function action(at: IHexCoordinates, actionType: EHexActionType) {
  return {
    heroId: HERO_ID,
    coordinates: at,
    actionType,
    toolKey: HEXOBJECT_KEYS.HAND,
    now: 1_000,
  };
}

function chestScene() {
  const server = sceneWorld();
  const entry = { ...server.heroCoordinates! };
  const chest = freeAround(server, entry);
  tileAt(server, chest).hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.CHEST, chest);
  tileAt(server, chest).isRevealed = true;
  return { server, client: copyOf(server), entry, chest };
}

beforeEach(() => {
  setActivePinia(createPinia());
  finishLootFlights();
});

describe('a chest answer reaches the client state', () => {
  it('moves the hero to the chest hex and shows the placed items with their quantities', () => {
    const { server, client, entry, chest } = chestScene();
    const result = resultOf(actWorld(runOn(server), action(chest, EHexActionType.OPEN)));
    const opened = result.events.find((event) => event.type === 'CHEST_OPENED')!;
    const placed = (opened.payload as { placed: { coordinates: IHexCoordinates }[] }).placed;
    expect(placed.length).toBeGreaterThan(0);
    const hero = heroAt(entry);

    applyWorldResultAction(hostOf(client.map).host, hero, result);

    expect(hero.heroCoordinates).toEqual(chest);
    expect(tileAt(client, chest).hexobject?.hexobjectKey).toBe(HEXOBJECT_KEYS.CHEST_OPEN);
    for (const item of placed) {
      const serverObject = tileAt(server, item.coordinates).hexobject;
      const clientObject = tileAt(client, item.coordinates).hexobject;
      expect(clientObject?.hexobjectKey).toBe(serverObject?.hexobjectKey);
      expect(clientObject?.quantity).toBe(serverObject?.quantity);
    }
  });

  it('queues a flight that fits the 800 ms budget', () => {
    const { server, client, entry, chest } = chestScene();
    const result = resultOf(actWorld(runOn(server), action(chest, EHexActionType.OPEN)));
    applyWorldResultAction(hostOf(client.map).host, heroAt(entry), result);
    expect(lootFlightRequest.value).not.toBeNull();
    expect(lootFlightRequest.value!.totalMs).toBeLessThanOrEqual(800);
  });

  it('the bag-only variant moves the hero and flies to the hero, with no tile changes', () => {
    const { client, entry, chest } = chestScene();
    const hero = heroAt(entry);
    const result = bareResult([
      {
        type: 'CHEST_OPENED',
        payload: {
          heroId: HERO_ID,
          coordinates: chest,
          from: entry,
          placed: [],
          toBag: [{ itemKey: 'coins', amount: 3 }],
        },
      },
    ]);

    applyWorldResultAction(hostOf(client.map).host, hero, result);

    expect(hero.heroCoordinates).toEqual(chest);
    expect(lootFlightRequest.value!.flights.every((flight) => flight.to === null)).toBe(true);
  });

  it('REQ-LOOT-114 an answer with both placed and toBag updates the map and flies the rest to the bag', () => {
    const { server, client, entry, chest } = chestScene();
    const result = resultOf(actWorld(runOn(server), action(chest, EHexActionType.OPEN)));
    const opened = result.events.find((event) => event.type === 'CHEST_OPENED')!;
    const payload = opened.payload as {
      placed: { coordinates: IHexCoordinates; itemKey: string }[];
      toBag: { itemKey: string; amount: number }[];
    };
    payload.toBag = [{ itemKey: 'crown-shard', amount: 1 }];
    const hero = heroAt(entry);

    applyWorldResultAction(hostOf(client.map).host, hero, result);

    expect(hero.heroCoordinates).toEqual(chest);
    for (const item of payload.placed) {
      expect(tileAt(client, item.coordinates).hexobject?.hexobjectKey).toBe(item.itemKey);
    }
    const flights = lootFlightRequest.value!.flights;
    expect(flights.filter((flight) => flight.to !== null)).toHaveLength(payload.placed.length);
    expect(flights.filter((flight) => flight.to === null)).toHaveLength(1);
  });

  it('a replayed answer refetches the world exactly once and applies nothing else', () => {
    const { client, entry, chest } = chestScene();
    const { host, refetchWorld, markTilesDirty } = hostOf(client.map);
    const hero = heroAt(entry);
    const result = bareResult(
      [
        {
          type: 'CHEST_OPENED',
          payload: { heroId: HERO_ID, coordinates: chest, from: entry, placed: [], toBag: [] },
        },
      ],
      { replayed: true },
    );

    applyWorldResultAction(host, hero, result);

    expect(refetchWorld).toHaveBeenCalledTimes(1);
    expect(markTilesDirty).not.toHaveBeenCalled();
    expect(hero.heroCoordinates).toEqual(entry);
    expect(lootFlightRequest.value).toBeNull();
  });
});

describe('other tool-ring actions leave the hero where he is', () => {
  it('TAKE of a stack next to the hero does not move the hero', () => {
    const server = sceneWorld();
    const entry = { ...server.heroCoordinates! };
    const spot = freeAround(server, entry);
    tileAt(server, spot).hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.COINS, spot, {
      quantity: 5,
    });
    const client = copyOf(server);
    const started = resultOf(actWorld(runOn(server), action(spot, EHexActionType.TAKE)));
    const hero = heroAt(entry);

    applyWorldResultAction(hostOf(client.map).host, hero, started);

    expect(hero.heroCoordinates).toEqual(entry);
    expect(lootFlightRequest.value).toBeNull();
  });

  it.each(['CUT', 'USE'])('a %s answer without a chest event does not move the hero', (kind) => {
    const { client, entry } = chestScene();
    const hero = heroAt(entry);
    const result = bareResult([{ type: 'HEX_ACTION_STARTED', payload: { actionType: kind } }]);

    applyWorldResultAction(hostOf(client.map).host, hero, result);

    expect(hero.heroCoordinates).toEqual(entry);
  });
});
