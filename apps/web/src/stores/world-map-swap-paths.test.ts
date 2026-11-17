import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { coordinateKey, getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type { LocationKey } from '@hexoflat/engine/registry/location-key';
import type { QuestProjection } from '@hexoflat/engine/quests/projection';
import { ensurePresence, type WorldCommandResult } from '@/services/inventory/inventory-sync';
import { forgetServerWorld } from '@/services/player/world-sync';
import { readCachedWorld } from '@/services/world/served-world';
import { getWorldSeed } from '@/services/rng/world-rng';
import { returnFromQuest } from '@/services/quests/quest-run-commands';
import { applyQuestRun, resetQuestRun } from '@/services/quests/quest-run-projection';
import {
  fakeEnsureWorld,
  fakePlaceHero,
  fakePresence,
  fakeStoredWorldOf,
} from '@/test-support/fake-player-server';
import { fakeStandIn, seedFakeSession } from '@/test-support/fake-session';
import { crossExitIfStanding } from '@/composables/use-board-crossing';
import { usePortal } from '@/composables/use-portal';
import { useQuestRunActions } from '@/composables/use-quest-run-actions';
import { useBattleStore } from './battle-store';
import { useHeroInventoryStore } from './hero-inventory-store';
import { useHeroStore } from './hero-store';
import { useWorldMapStore } from './world-map-store';

vi.mock('@/services/player/player-socket', async () =>
  (await import('@/test-support/fake-player-server')).fakePlayerSocketModule(),
);
vi.mock('@/services/world/location-navigator', () => ({
  navigateToLocation: vi.fn(),
  isViewingOtherWorldLocation: vi.fn(() => false),
  isViewingWorldLocation: vi.fn(() => false),
  routeToLocation: vi.fn(async () => {}),
  replaceLocationRoute: vi.fn(async () => {}),
}));
vi.mock('@/services/quests/quest-run-commands', () => ({
  giveUpQuest: vi.fn(),
  pauseQuest: vi.fn(),
  openQuestChest: vi.fn(),
  pickUpQuestLoot: vi.fn(),
  returnFromQuest: vi.fn(),
  startSeekerQuest: vi.fn(),
  stepQuest: vi.fn(),
  stepQuestBack: vi.fn(),
}));

const HERO = 'hero-swap';

function storeState() {
  const world = useWorldMapStore();
  const hero = useHeroStore();
  const map = world.map as HexMapModel | null;
  const cached = readCachedWorld(world.currentLocationKey);
  const served = fakeStoredWorldOf(world.currentLocationKey);
  return {
    locationKey: world.currentLocationKey,
    mapIsServed: world.currentMapId !== null && world.currentMapId === served?.mapId,
    mapId: world.currentMapId === null ? null : 'set',
    failed: world.worldLoadFailed,
    descriptor: world.descriptor?.kind ?? null,
    tiles: map?.tiles.length ?? 0,
    revealed: map?.tiles.filter((tile) => tile.isRevealed).length ?? 0,
    hero: hero.heroCoordinates,
    nav: {
      locationKey: hero.nav.locationKey,
      mapIsCurrent: hero.nav.locationMapId === world.currentMapId,
    },
    dirtyTick: world.dirtyTick,
    seededFromServer: getWorldSeed() === (served?.worldSeed ?? null),
    battle: useBattleStore().engagement !== null,
    cache: cached
      ? {
          sameMap: cached.mapId === world.currentMapId,
          sameHero:
            coordinateKey(cached.heroCoordinates ?? { columnIndex: -1, rowIndex: -1 }) ===
            coordinateKey(hero.heroCoordinates ?? { columnIndex: -1, rowIndex: -1 }),
          revealed: cached.map.tiles.filter((tile) => tile.isRevealed).length,
        }
      : null,
  };
}

function start(will = 20) {
  setActivePinia(createPinia());
  const hero = useHeroStore();
  hero.hero.id = HERO;
  seedFakeSession(HERO, { will, skills: { a_crest: 1, a_teleport: 6 } });
  hero.loadKnowledge();
  return { hero, world: useWorldMapStore() };
}

function standIn(locationKey: LocationKey) {
  const { world, hero } = start();
  fakeStandIn(locationKey);
  world.goToLocation(locationKey);
  return { world, hero };
}

function freeNeighbour(map: HexMapModel, from: { columnIndex: number; rowIndex: number }) {
  return getHexNeighbors(from).find((at) => {
    const tile = map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(at));
    return tile?.terrain === 'ground' && !tile.hexobject && !tile.exit;
  })!;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function prepareEachPath() {
  resetQuestRun();
  let uuid = 0;
  vi.spyOn(crypto, 'randomUUID').mockImplementation(
    () => `00000000-0000-4000-8000-${String((uuid += 1)).padStart(12, '0')}` as const,
  );
  vi.stubGlobal('navigator', { locks: { request: (_key: string, run: () => unknown) => run() } });
}

describe('REQ-1: loading and travelling end in the same store state', () => {
  beforeEach(prepareEachPath);

  it('bootstrap', () => {
    const { world } = start();
    fakeStandIn('silesia');

    world.bootstrapWorld();

    expect(storeState()).toMatchInlineSnapshot(`
      {
        "battle": false,
        "cache": {
          "revealed": 87,
          "sameHero": true,
          "sameMap": true,
        },
        "descriptor": "STATIC",
        "dirtyTick": 34,
        "failed": false,
        "hero": {
          "columnIndex": 8,
          "rowIndex": 5,
        },
        "locationKey": "silesia",
        "mapId": "set",
        "mapIsServed": true,
        "nav": {
          "locationKey": "silesia",
          "mapIsCurrent": true,
        },
        "revealed": 87,
        "seededFromServer": false,
        "tiles": 302,
      }
    `);
  });

  it('retry after a failed load', async () => {
    const { world } = start();
    fakeStandIn('silesia');
    forgetServerWorld('silesia');
    world.goToLocation('silesia');
    expect(storeState()).toMatchInlineSnapshot(`
      {
        "battle": false,
        "cache": null,
        "descriptor": null,
        "dirtyTick": 0,
        "failed": true,
        "hero": null,
        "locationKey": "silesia",
        "mapId": null,
        "mapIsServed": false,
        "nav": {
          "locationKey": "camping",
          "mapIsCurrent": true,
        },
        "revealed": 0,
        "seededFromServer": false,
        "tiles": 0,
      }
    `);

    await world.retryWorldLoad();

    expect(storeState()).toMatchInlineSnapshot(`
      {
        "battle": false,
        "cache": {
          "revealed": 87,
          "sameHero": true,
          "sameMap": true,
        },
        "descriptor": "STATIC",
        "dirtyTick": 34,
        "failed": false,
        "hero": {
          "columnIndex": 8,
          "rowIndex": 5,
        },
        "locationKey": "silesia",
        "mapId": "set",
        "mapIsServed": true,
        "nav": {
          "locationKey": "silesia",
          "mapIsCurrent": true,
        },
        "revealed": 87,
        "seededFromServer": false,
        "tiles": 302,
      }
    `);
  });

  it('travel across a board edge', async () => {
    const { world, hero } = standIn('silesia');
    const exit = world.map!.tiles.find((tile) => tile.exit === 'N')!;
    await ensurePresence({ locationKey: 'silesia', mapId: world.currentMapId! });
    fakePlaceHero(exit.coordinates);
    hero.heroCoordinates = { ...exit.coordinates };

    expect(await crossExitIfStanding()).toBe(true);

    expect(storeState()).toMatchInlineSnapshot(`
      {
        "battle": false,
        "cache": {
          "revealed": 181,
          "sameHero": true,
          "sameMap": true,
        },
        "descriptor": "STATIC",
        "dirtyTick": 149,
        "failed": false,
        "hero": {
          "columnIndex": 7,
          "rowIndex": 15,
        },
        "locationKey": "silesia-north",
        "mapId": "set",
        "mapIsServed": true,
        "nav": {
          "locationKey": "silesia-north",
          "mapIsCurrent": true,
        },
        "revealed": 181,
        "seededFromServer": true,
        "tiles": 306,
      }
    `);
  });

  it('portal', async () => {
    const { world, hero } = standIn('silesia');
    useHeroInventoryStore().hydrate();
    useHeroInventoryStore().putToInventory(HEXOBJECT_KEYS.RETURN_SCROLL, 1);
    const portal = usePortal();
    expect(
      (await portal.openPortal(freeNeighbour(world.map as HexMapModel, hero.heroCoordinates!))).ok,
    ).toBe(true);

    expect((await portal.enterPortal()).ok).toBe(true);

    expect(storeState()).toMatchInlineSnapshot(`
      {
        "battle": false,
        "cache": {
          "revealed": 61,
          "sameHero": true,
          "sameMap": true,
        },
        "descriptor": "STATIC",
        "dirtyTick": 66,
        "failed": false,
        "hero": {
          "columnIndex": 8,
          "rowIndex": 7,
        },
        "locationKey": "camping",
        "mapId": "set",
        "mapIsServed": true,
        "nav": {
          "locationKey": "camping",
          "mapIsCurrent": true,
        },
        "revealed": 61,
        "seededFromServer": true,
        "tiles": 61,
      }
    `);
  });
});

describe('REQ-1: returns, pushed maps, dev boards and logout end in the same store state', () => {
  beforeEach(prepareEachPath);

  it('quest run exit', async () => {
    standIn('silesia');
    applyQuestRun({ phase: 'collect' } as QuestProjection);
    vi.mocked(returnFromQuest).mockImplementation(() => {
      fakeStandIn('camping');
      resetQuestRun();
      return Promise.resolve({ ok: true });
    });

    expect(await useQuestRunActions().returnToCamp()).toBe(true);

    expect(storeState()).toMatchInlineSnapshot(`
      {
        "battle": false,
        "cache": {
          "revealed": 61,
          "sameHero": true,
          "sameMap": true,
        },
        "descriptor": "STATIC",
        "dirtyTick": 65,
        "failed": false,
        "hero": {
          "columnIndex": 7,
          "rowIndex": 5,
        },
        "locationKey": "camping",
        "mapId": "set",
        "mapIsServed": true,
        "nav": {
          "locationKey": "camping",
          "mapIsCurrent": true,
        },
        "revealed": 61,
        "seededFromServer": false,
        "tiles": 61,
      }
    `);
  });

  it('camp respawn', async () => {
    const { world } = standIn('silesia');
    fakeStandIn('camping');
    const camp = fakeEnsureWorld('camping');
    const result = {
      ok: true,
      tileDiffs: [],
      events: [],
      effects: [],
      engagement: null,
      steps: [],
      serverNowMs: null,
      travel: { locationKey: 'camping', world: camp },
    } as unknown as WorldCommandResult;

    await world.respawnHeroAtCamping(result);

    expect(storeState()).toMatchInlineSnapshot(`
      {
        "battle": false,
        "cache": {
          "revealed": 61,
          "sameHero": true,
          "sameMap": true,
        },
        "descriptor": "STATIC",
        "dirtyTick": 65,
        "failed": false,
        "hero": {
          "columnIndex": 7,
          "rowIndex": 5,
        },
        "locationKey": "camping",
        "mapId": "set",
        "mapIsServed": true,
        "nav": {
          "locationKey": "camping",
          "mapIsCurrent": true,
        },
        "revealed": 61,
        "seededFromServer": false,
        "tiles": 61,
      }
    `);
  });

  it('a map the server pushes again after a replayed answer', async () => {
    const { world } = standIn('silesia');
    const moved = freeNeighbour(world.map as HexMapModel, fakePresence()!.coordinates);
    fakePlaceHero(moved);

    world.applyWorldResult({
      ok: true,
      replayed: true,
      mapId: world.currentMapId!,
      tileDiffs: [],
      events: [],
      effects: [],
      engagement: null,
      steps: [],
      serverNowMs: null,
    });
    await settle();

    expect(useHeroStore().heroCoordinates).toEqual(moved);
    expect(storeState()).toMatchInlineSnapshot(`
      {
        "battle": false,
        "cache": {
          "revealed": 87,
          "sameHero": true,
          "sameMap": true,
        },
        "descriptor": "STATIC",
        "dirtyTick": 35,
        "failed": false,
        "hero": {
          "columnIndex": 9,
          "rowIndex": 4,
        },
        "locationKey": "silesia",
        "mapId": "set",
        "mapIsServed": true,
        "nav": {
          "locationKey": "silesia",
          "mapIsCurrent": true,
        },
        "revealed": 87,
        "seededFromServer": false,
        "tiles": 302,
      }
    `);
  });

  it('a fresh dev board', () => {
    const { world } = standIn('cave');

    world.devNextSeed();

    expect(storeState()).toMatchInlineSnapshot(`
      {
        "battle": false,
        "cache": {
          "revealed": 7,
          "sameHero": false,
          "sameMap": true,
        },
        "descriptor": "RECIPE",
        "dirtyTick": 152,
        "failed": false,
        "hero": {
          "columnIndex": 15,
          "rowIndex": 13,
        },
        "locationKey": "cave",
        "mapId": "set",
        "mapIsServed": true,
        "nav": {
          "locationKey": "cave",
          "mapIsCurrent": true,
        },
        "revealed": 7,
        "seededFromServer": false,
        "tiles": 141,
      }
    `);
  });

  it('logout clears every world', () => {
    const { world } = standIn('silesia');

    world.clearAllWorlds();

    expect(storeState()).toMatchInlineSnapshot(`
      {
        "battle": false,
        "cache": null,
        "descriptor": null,
        "dirtyTick": 34,
        "failed": false,
        "hero": null,
        "locationKey": "camping",
        "mapId": null,
        "mapIsServed": false,
        "nav": {
          "locationKey": "silesia",
          "mapIsCurrent": false,
        },
        "revealed": 0,
        "seededFromServer": false,
        "tiles": 0,
      }
    `);
  });
});
