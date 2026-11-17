import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createApp, defineComponent, onMounted, type App } from 'vue';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { coordinateKey, getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { LocationKey } from '@hexoflat/engine/registry/location-key';
import { createServerWorld } from '@hexoflat/engine';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { apiClient } from '@/api/client';
import { PlayerSocket, type PlayerEnvelope } from '@/services/player/player-socket';
import type { WorldCommandResult } from '@/services/inventory/inventory-sync';
import { inventorySession } from '@/services/inventory/inventory-session';
import { evictStaleServerWorld } from '@/services/player/world-sync';
import { reportMapMismatch } from '@/services/world/presence-location';
import { readCachedWorld } from '@/services/world/served-world';
import { portalFxBusy, registerPortalFx } from '@/render/portal-fx';
import { usePortal } from '@/composables/use-portal';
import { usePresenceRoute } from '@/composables/use-presence-route';
import { fakeProgressRow, fakeStoredWorldOf, snapshot } from '@/test-support/fake-player-server';
import { fakeStandIn, seedFakeSession } from '@/test-support/fake-session';
import type { MapSwap } from './active-map-swap';
import { useHeroInventoryStore } from './hero-inventory-store';
import { useHeroStore } from './hero-store';
import { useHeroToolStore } from './hero-tool-store';
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

const HERO = 'hero-latest-request';
const SCROLL = HEXOBJECT_KEYS.RETURN_SCROLL;
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function routeKey(): LocationKey | undefined {
  const route = fakeRouter.current!.value;
  return route.name === 'world' ? (route.params.locationKey as LocationKey) : undefined;
}

function goRoute(locationKey: LocationKey) {
  fakeRouter.current!.value = { name: 'world', params: { locationKey } };
}

let app: App | null = null;

function scene(locationKey: LocationKey) {
  setActivePinia(createPinia());
  const hero = useHeroStore();
  hero.hero.id = HERO;
  seedFakeSession(HERO, { will: 20, skills: { a_crest: 1, a_teleport: 6 } });
  hero.loadKnowledge();
  fakeStandIn(locationKey);
  goRoute(locationKey);
  const world = useWorldMapStore();
  app = createApp(
    defineComponent({
      setup() {
        usePresenceRoute(routeKey);
        onMounted(() => world.bootstrapWorld());
        return () => null;
      },
    }),
  );
  app.mount(document.createElement('div'));
  fakeRouter.log.length = 0;
  return { hero, world, swaps: recordSwaps(world) };
}

function recordSwaps(world: ReturnType<typeof useWorldMapStore>): (LocationKey | null)[] {
  const swaps: (LocationKey | null)[] = [];
  const swapMap = world.swapMap.bind(world);
  world.swapMap = (swap: MapSwap) => {
    swaps.push(
      swap.kind === 'served' || swap.kind === 'missing'
        ? swap.locationKey
        : swap.kind === 'refetched'
          ? swap.served.locationKey
          : null,
    );
    swapMap(swap);
  };
  return swaps;
}

function holdEnsureRequests() {
  const gate = deferred();
  const post = vi.mocked(apiClient.post).getMockImplementation()!;
  vi.mocked(apiClient.post).mockImplementation(async (path, body) => {
    if (path === '/player/world/ensure') await gate.promise;
    return post(path, body);
  });
  vi.mocked(apiClient.post).mockClear();
  return gate;
}

function ensureRequests(): string[] {
  return vi
    .mocked(apiClient.post)
    .mock.calls.filter(([path]) => path === '/player/world/ensure')
    .map(([, body]) => (body as { locationKey: string }).locationKey);
}

function evict(locationKey: LocationKey) {
  evictStaleServerWorld(locationKey, readCachedWorld(locationKey)!.mapId);
}

function replayedAnswer(mapId: string): WorldCommandResult {
  return {
    ok: true,
    replayed: true,
    mapId,
    tileDiffs: [],
    events: [],
    effects: [],
    engagement: null,
    steps: [],
    serverNowMs: null,
  };
}

function holdAnswerOf(type: string) {
  const gate = deferred();
  const sent = deferred();
  const original = Reflect.get(PlayerSocket.prototype, 'sendWorld') as (
    envelope: PlayerEnvelope,
  ) => Promise<unknown>;
  vi.spyOn(PlayerSocket.prototype, 'sendWorld').mockImplementation(async function (
    this: PlayerSocket,
    envelope: PlayerEnvelope,
  ) {
    const answer = await original.call(this, envelope);
    if (envelope.command.type === type) {
      sent.resolve();
      await gate.promise;
    }
    return answer as never;
  });
  return { sent: sent.promise, release: gate.resolve };
}

function freeNeighbour(map: HexMapModel, from: IHexCoordinates): IHexCoordinates {
  return getHexNeighbors(from).find((at) => {
    const tile = map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(at));
    return tile?.isRevealed && tile.terrain === 'ground' && !tile.hexobject && !tile.exit;
  })!;
}

function serverScrolls(): number {
  const state = snapshot().aggregates.inventory!.state as InventoryState;
  return [...state.bag, ...Object.values(state.equip)]
    .filter((item) => item?.key === SCROLL)
    .reduce((sum, item) => sum + ((item as { quantity?: number }).quantity ?? 1), 0);
}

function showAnotherSilesiaMap(world: ReturnType<typeof useWorldMapStore>) {
  const other = createServerWorld('silesia', 'silesia-other', 'other-seed', HERO);
  world.swapMap({ kind: 'served', locationKey: 'silesia', served: other });
  return other;
}

function portalHexesOn(map: HexMapModel): number {
  return map.tiles.filter((tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.RETURN_PORTAL)
    .length;
}

beforeEach(() => {
  vi.restoreAllMocks();
  fakeRouter.log.length = 0;
  vi.stubGlobal('navigator', { locks: { request: (_key: string, run: () => unknown) => run() } });
});

afterEach(() => {
  app?.unmount();
  app = null;
});

describe('MAPFIX-7 #2: the latest map request wins', () => {
  it('REQ-1: a refetch that swaps nothing does not cancel an evicted map load; route equals board', async () => {
    const { world } = scene('camping');
    const campId = world.currentMapId!;
    evict('silesia');
    fakeStandIn('silesia');
    const gate = holdEnsureRequests();
    vi.mocked(apiClient.get).mockResolvedValue(null);

    goRoute('silesia');
    await vi.waitFor(() => expect(ensureRequests()).toEqual(['silesia']));
    world.applyWorldResult(replayedAnswer(campId));
    await settle();
    gate.resolve();
    await settle();

    expect(world.currentLocationKey).toBe('silesia');
    expect(world.currentMapId).toBe(fakeStoredWorldOf('silesia')!.mapId);
    expect(routeKey()).toBe(world.currentLocationKey);
  });

  it('REQ-2: two loads of one evicted location make one request and only the latest one applies', async () => {
    const { world, swaps } = scene('camping');
    evict('silesia');
    const gate = holdEnsureRequests();

    const first = world.reloadLocationMap('silesia');
    world.goToLocation('cave');
    const second = world.reloadLocationMap('silesia');
    gate.resolve();
    await Promise.all([first, second]);

    expect(ensureRequests()).toEqual(['silesia']);
    expect(swaps).toEqual(['cave', 'silesia']);
    expect(world.currentLocationKey).toBe('silesia');
  });

  it('REQ-3: a superseded recovery leaves the board on the latest target and the route on the board', async () => {
    const { world } = scene('silesia');
    const gate = holdEnsureRequests();

    reportMapMismatch();
    await vi.waitFor(() => expect(ensureRequests()).toEqual(['silesia']));
    fakeStandIn('cave');
    world.goToLocation('cave');
    goRoute('cave');
    await settle();
    fakeRouter.log.length = 0;
    gate.resolve();
    await settle();

    expect(world.currentLocationKey).toBe('cave');
    expect(routeKey()).toBe('cave');
    expect(fakeRouter.log).toEqual([]);
  });
});

describe('MAPFIX-7 #7: drop the render, never the server effect', () => {
  function inSilesiaWithScroll() {
    const setup = scene('silesia');
    useHeroInventoryStore().hydrate();
    useHeroInventoryStore().putToInventory(SCROLL, 1);
    return setup;
  }

  it('REQ-4: a portal OPEN answer for a map no longer shown: board untouched, one resync, Will and scroll as on the server', async () => {
    const { hero, world, swaps } = inSilesiaWithScroll();
    const spot = freeNeighbour(world.map as HexMapModel, hero.heroCoordinates!);
    const tool = useHeroToolStore();
    tool.activeTool = SCROLL;
    const willBefore = hero.knowledge!.current;
    const answer = holdAnswerOf('WORLD_PORTAL_OPEN');
    vi.mocked(apiClient.post).mockClear();

    const opening = usePortal().openPortal(spot);
    await answer.sent;
    const other = showAnotherSilesiaMap(world);
    answer.release();
    const outcome = await opening;
    await settle();

    expect(outcome.ok).toBe(false);
    expect(portalHexesOn(other.map)).toBe(0);
    expect(swaps).toEqual(['silesia', 'silesia']);
    expect(ensureRequests()).toEqual(['silesia']);
    expect(world.currentMapId).toBe(fakeStoredWorldOf('silesia')!.mapId);
    expect(portalHexesOn(world.map as HexMapModel)).toBe(1);
    expect(hero.knowledge!.current).toBe(fakeProgressRow().state.knowledge.current);
    expect(hero.knowledge!.current).toBeLessThan(willBefore);
    expect(useHeroInventoryStore().countItem(SCROLL)).toBe(serverScrolls());
    expect(tool.activeTool).toBeNull();
    expect(portalFxBusy.value).toBe(false);
  });

  it('REQ-4: a portal ENTER answer after the map changed: no animation left, one resync to the camp, route equals board', async () => {
    const { hero, world, swaps } = inSilesiaWithScroll();
    const spot = freeNeighbour(world.map as HexMapModel, hero.heroCoordinates!);
    const portal = usePortal();
    expect((await portal.openPortal(spot)).ok).toBe(true);
    const fx = { enter: vi.fn(async () => {}), exit: vi.fn(async () => {}), release: vi.fn() };
    const unregister = registerPortalFx(fx);
    const answer = holdAnswerOf('WORLD_PORTAL_ENTER');
    swaps.length = 0;
    vi.mocked(apiClient.post).mockClear();

    const entering = portal.enterPortal();
    await answer.sent;
    showAnotherSilesiaMap(world);
    answer.release();
    const outcome = await entering;
    await settle();

    expect(outcome.ok).toBe(false);
    expect(fx.release).toHaveBeenCalledTimes(1);
    expect(fx.exit).not.toHaveBeenCalled();
    expect(portalFxBusy.value).toBe(false);
    expect(ensureRequests()).toEqual(['camping']);
    expect(swaps).toEqual(['silesia', 'camping']);
    expect(world.currentLocationKey).toBe('camping');
    expect(routeKey()).toBe('camping');
    expect(inventorySession.portal).toEqual(fakeProgressRow().state.portal);
    expect(hero.knowledge!.current).toBe(fakeProgressRow().state.knowledge.current);
    unregister();
  });

  it('a step answer after the map changed resyncs the held map once', async () => {
    const { hero, world } = scene('silesia');
    const target = freeNeighbour(world.map as HexMapModel, hero.heroCoordinates!);
    const answer = holdAnswerOf('WORLD_STEP');
    vi.mocked(apiClient.post).mockClear();

    const walking = hero.moveHeroTo(target);
    await answer.sent;
    showAnotherSilesiaMap(world);
    answer.release();
    expect(await walking).toBe(false);
    await settle();

    expect(ensureRequests()).toEqual(['silesia']);
    expect(world.currentMapId).toBe(fakeStoredWorldOf('silesia')!.mapId);
    expect(hero.heroCoordinates).toEqual(target);
  });
});
