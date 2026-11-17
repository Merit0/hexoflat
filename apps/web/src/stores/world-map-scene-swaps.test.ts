import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createApp, defineComponent, onMounted, type App } from 'vue';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { coordinateKey, getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { LocationKey } from '@hexoflat/engine/registry/location-key';
import type { QuestProjection } from '@hexoflat/engine/quests/projection';
import { createServerWorld, type ServerWorld } from '@hexoflat/engine';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import { apiClient } from '@/api/client';
import { ensurePresence, type WorldCommandResult } from '@/services/inventory/inventory-sync';
import { evictStaleServerWorld } from '@/services/player/world-sync';
import { reportMapMismatch } from '@/services/world/presence-location';
import { crossExitIfStanding } from '@/composables/use-board-crossing';
import { usePortal } from '@/composables/use-portal';
import { giveUpQuest, pauseQuest, returnFromQuest } from '@/services/quests/quest-run-commands';
import { applyQuestRun, resetQuestRun } from '@/services/quests/quest-run-projection';
import { readCachedWorld } from '@/services/world/served-world';
import {
  fakeEnsureWorld,
  fakePlaceHero,
  fakeStoredWorldOf,
} from '@/test-support/fake-player-server';
import { fakeStandIn, holdServedWorld, seedFakeSession } from '@/test-support/fake-session';
import { usePresenceRoute } from '@/composables/use-presence-route';
import { useQuestMapRoute } from '@/composables/use-quest-map-route';
import { useQuestRunActions } from '@/composables/use-quest-run-actions';
import type { MapSwap } from './active-map-swap';
import { useHeroInventoryStore } from './hero-inventory-store';
import { useHeroStore } from './hero-store';
import { useWorldMapStore } from './world-map-store';

const fakeRouter = vi.hoisted(() => ({
  current: null as { value: { name: string; params: { locationKey?: string } } } | null,
  log: [] as string[],
}));

vi.mock('@/router', async () => {
  const { shallowRef } = await import('vue');
  fakeRouter.current = shallowRef({ name: 'world', params: {} });
  const go = (to: { name: string; params?: { locationKey?: string } }) => {
    fakeRouter.current!.value = { name: to.name, params: { ...to.params } };
    fakeRouter.log.push(to.params?.locationKey ? `${to.name}:${to.params.locationKey}` : to.name);
    return Promise.resolve();
  };
  return {
    ROUTES: { WORLD: 'world', QUEST_MAP: 'quest-map' },
    default: { currentRoute: fakeRouter.current, push: go, replace: go },
  };
});
vi.mock('@/services/player/player-socket', async () =>
  (await import('@/test-support/fake-player-server')).fakePlayerSocketModule(),
);
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

const HERO = 'hero-quest-exit';
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

interface SwapRecord {
  kind: MapSwap['kind'];
  locationKey: LocationKey | null;
  hero: string | null;
}

function routeKey(): LocationKey | undefined {
  const route = fakeRouter.current!.value;
  return route.name === 'world' ? (route.params.locationKey as LocationKey) : undefined;
}

function freeNeighbour(map: HexMapModel, from: IHexCoordinates): IHexCoordinates {
  return getHexNeighbors(from).find((at) => {
    const tile = map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(at));
    return tile?.terrain === 'ground' && !tile.hexobject && !tile.exit;
  })!;
}

function recordSwaps(world: ReturnType<typeof useWorldMapStore>): SwapRecord[] {
  const swaps: SwapRecord[] = [];
  const swapMap = world.swapMap.bind(world);
  world.swapMap = (swap: MapSwap) => {
    const served = swap.kind === 'served' || swap.kind === 'refetched' ? swap.served : null;
    swaps.push({
      kind: swap.kind,
      locationKey: swap.kind === 'served' ? swap.locationKey : (served?.locationKey ?? null),
      hero: served?.heroCoordinates ? coordinateKey(served.heroCoordinates) : null,
    });
    swapMap(swap);
  };
  return swaps;
}

function mapRequests() {
  const gets = vi.mocked(apiClient.get).mock.calls.filter(([path]) => path === '/player/world');
  const posts = vi
    .mocked(apiClient.post)
    .mock.calls.filter(([path]) => path === '/player/world/ensure');
  return gets.length + posts.length;
}

let app: App | null = null;

function mountScene(world: ReturnType<typeof useWorldMapStore>) {
  app = createApp(
    defineComponent({
      setup() {
        useQuestMapRoute(() => world.currentLocationKey);
        usePresenceRoute(routeKey);
        onMounted(() => world.bootstrapWorld());
        return () => null;
      },
    }),
  );
  app.mount(document.createElement('div'));
}

function start() {
  setActivePinia(createPinia());
  const hero = useHeroStore();
  hero.hero.id = HERO;
  seedFakeSession(HERO, { will: 20, skills: { a_crest: 1, a_teleport: 6 } });
  hero.loadKnowledge();
  return { hero, world: useWorldMapStore() };
}

function startInQuest() {
  start();
  const camp = fakeStoredWorldOf('camping')!;
  const campReturn = freeNeighbour(camp.map, camp.heroCoordinates!);
  fakeStandIn('camping');
  fakePlaceHero(campReturn);
  fakeStandIn('silesia');
  const world = useWorldMapStore();
  world.goToLocation('silesia');
  fakeRouter.current!.value = { name: 'quest-map', params: {} };
  applyQuestRun({ phase: 'walking' } as QuestProjection);
  mountScene(world);
  fakeRouter.log.length = 0;
  const requestsBefore = mapRequests();
  return {
    world,
    swaps: recordSwaps(world),
    campReturn: coordinateKey(campReturn),
    requests: () => mapRequests() - requestsBefore,
  };
}

function answerEndsRun(command: typeof returnFromQuest) {
  vi.mocked(command).mockImplementation(() => {
    fakeStandIn('camping');
    applyQuestRun(null);
    return Promise.resolve({ ok: true });
  });
}

beforeEach(() => {
  resetQuestRun();
  fakeRouter.log.length = 0;
  vi.stubGlobal('navigator', { locks: { request: (_key: string, run: () => unknown) => run() } });
});

afterEach(() => {
  app?.unmount();
  app = null;
});

describe('REQ-5: a quest exit loads the camp once, from the server', () => {
  const exits = [
    ['return', returnFromQuest, () => useQuestRunActions().returnToCamp()],
    ['pause', pauseQuest, () => useQuestRunActions().pause()],
    ['give up', giveUpQuest, () => useQuestRunActions().giveUp()],
  ] as const;

  it.each(exits)('%s', async (_name, command, leave) => {
    const { world, swaps, campReturn, requests } = startInQuest();
    expect(readCachedWorld('camping')?.heroCoordinates).not.toEqual(campReturn);
    answerEndsRun(command);

    expect(await leave()).toBe(true);
    await settle();

    expect(fakeRouter.log).toEqual(['world:camping']);
    expect(swaps).toEqual([{ kind: 'served', locationKey: 'camping', hero: campReturn }]);
    expect(requests()).toBe(1);
    expect(world.currentLocationKey).toBe('camping');
    expect(coordinateKey(useHeroStore().heroCoordinates!)).toBe(campReturn);
  });

  it('a refused exit keeps the quest route and loads nothing', async () => {
    const { swaps, requests } = startInQuest();
    vi.mocked(returnFromQuest).mockResolvedValue({ ok: false, reason: 'NOT_ADJACENT' });

    expect(await useQuestRunActions().returnToCamp()).toBe(false);
    await settle();

    expect(fakeRouter.log).toEqual([]);
    expect(swaps).toEqual([]);
    expect(requests()).toBe(0);
  });
});

function inScene(locationKey: LocationKey, served?: ServerWorld) {
  const { hero, world } = start();
  if (served) holdServedWorld(served);
  fakeStandIn(locationKey);
  fakeRouter.current!.value = { name: 'world', params: { locationKey } };
  mountScene(world);
  fakeRouter.log.length = 0;
  return { hero, world, swaps: recordSwaps(world) };
}

function silesiaWithGate(): { served: ServerWorld; gate: IHexCoordinates } {
  const served = createServerWorld('silesia', 'silesia-gate-map', 'seed', HERO);
  const gate = freeNeighbour(served.map, served.heroCoordinates!);
  const tile = served.map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(gate))!;
  tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.CAVE_ENTRANCE, gate);
  tile.isRevealed = true;
  return { served, gate };
}

describe('REQ-7: other ways to change the map still swap it once', () => {
  it('portal', async () => {
    const { world, hero, swaps } = inScene('silesia');
    useHeroInventoryStore().hydrate();
    useHeroInventoryStore().putToInventory(HEXOBJECT_KEYS.RETURN_SCROLL, 1);
    const portal = usePortal();
    const spot = freeNeighbour(world.map as HexMapModel, hero.heroCoordinates!);
    expect((await portal.openPortal(spot)).ok).toBe(true);

    expect((await portal.enterPortal()).ok).toBe(true);
    await settle();

    expect(world.currentLocationKey).toBe('camping');
    expect(swaps.map((swap) => swap.locationKey)).toEqual(['camping']);
  });

  it('travel through a gate', async () => {
    const { served, gate } = silesiaWithGate();
    const { world, swaps } = inScene('silesia', served);

    const outcome = await world.executeHexAction(
      world.getTileAt(gate)!,
      EHexActionType.ENTER,
      HEXOBJECT_KEYS.HAND,
    );
    await settle();

    expect(outcome.ok).toBe(true);
    expect(fakeRouter.log).toEqual(['world:cave']);
    expect(swaps.map((swap) => swap.locationKey)).toEqual(['cave']);
  });

  it('board crossing', async () => {
    const { world, hero, swaps } = inScene('silesia');
    const exit = world.map!.tiles.find((tile) => tile.exit === 'N')!;
    await ensurePresence({ locationKey: 'silesia', mapId: world.currentMapId! });
    fakePlaceHero(exit.coordinates);
    hero.heroCoordinates = { ...exit.coordinates };

    expect(await crossExitIfStanding()).toBe(true);
    await settle();

    expect(fakeRouter.log).toEqual(['world:silesia-north']);
    expect(swaps.map((swap) => swap.locationKey)).toEqual(['silesia-north']);
  });

  it('camp respawn', async () => {
    const { world, swaps } = inScene('silesia');
    fakeStandIn('camping');
    const result = {
      ok: true,
      tileDiffs: [],
      events: [],
      effects: [],
      engagement: null,
      steps: [],
      serverNowMs: null,
      travel: { locationKey: 'camping', world: fakeEnsureWorld('camping') },
    } as unknown as WorldCommandResult;

    await world.respawnHeroAtCamping(result);
    await settle();

    expect(fakeRouter.log).toEqual(['world:camping']);
    expect(swaps.map((swap) => swap.locationKey)).toEqual(['camping']);
  });

  it('reload after MAP_MISMATCH', async () => {
    const { swaps } = inScene('silesia');

    reportMapMismatch();
    await settle();

    expect(fakeRouter.log).toEqual([]);
    expect(swaps.map((swap) => swap.locationKey)).toEqual(['silesia']);
  });

  it('deep link to another location', async () => {
    const { world } = start();
    fakeStandIn('silesia');
    fakeRouter.current!.value = { name: 'world', params: { locationKey: 'cave' } };
    const swaps = recordSwaps(world);

    mountScene(world);
    await settle();

    expect(fakeRouter.log).toEqual(['world:silesia']);
    expect(swaps.map((swap) => swap.locationKey)).toEqual(['silesia']);
  });
});

describe('REQ-8: an evicted map is asked for once', () => {
  it('two loads of one location share one server request and show the same map', async () => {
    const { world } = start();
    fakeStandIn('camping');
    world.goToLocation('camping');
    const silesia = readCachedWorld('silesia')!;
    evictStaleServerWorld('silesia', silesia.mapId);
    fakeStandIn('silesia');
    const before = mapRequests();
    const swaps = recordSwaps(world);

    const first = world.reloadLocationMap('silesia').then(() => world.map);
    const second = world.reloadLocationMap('silesia').then(() => world.map);
    const [firstMap, secondMap] = await Promise.all([first, second]);

    expect(mapRequests() - before).toBe(1);
    expect(firstMap).not.toBeNull();
    expect(firstMap).toBe(secondMap);
    expect(world.currentMapId).toBe(silesia.mapId);
    expect(swaps.map((swap) => swap.locationKey)).toEqual(['silesia']);
  });
});
