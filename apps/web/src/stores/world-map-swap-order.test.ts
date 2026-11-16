import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createApp, defineComponent, nextTick, onMounted, ref, watch, type Ref } from 'vue';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { coordinateKey, getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import type { LocationKey } from '@hexoflat/engine/registry/location-key';
import { apiClient } from '@/api/client';
import { forgetServerWorld } from '@/services/player/world-sync';
import { fakePlaceHero, fakePresence } from '@/test-support/fake-player-server';
import { fakeWorldSnapshot } from '@/test-support/fake-battle-fixtures';
import { fakeStandIn, seedFakeSession } from '@/test-support/fake-session';
import { usePresenceRoute } from '@/composables/use-presence-route';
import type { WorldCommandResult } from '@/services/inventory/inventory-sync';
import { useHeroStore } from './hero-store';
import { useWorldMapStore } from './world-map-store';

const route = vi.hoisted(() => ({ current: null as { value: unknown } | null }));

vi.mock('@/services/player/player-socket', async () =>
  (await import('@/test-support/fake-player-server')).fakePlayerSocketModule(),
);
vi.mock('@/services/world/location-navigator', () => ({
  navigateToLocation: vi.fn(),
  isViewingOtherWorldLocation: vi.fn(() => false),
  routeToLocation: vi.fn(async () => {}),
  replaceLocationRoute: vi.fn((key: string) => {
    if (route.current) route.current.value = key;
    return Promise.resolve();
  }),
}));

const HERO = 'hero-swap-order';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function start() {
  setActivePinia(createPinia());
  const hero = useHeroStore();
  hero.hero.id = HERO;
  seedFakeSession(HERO);
  return { hero, world: useWorldMapStore() };
}

function countMapSwaps(world: ReturnType<typeof useWorldMapStore>) {
  const swaps = { count: 0 };
  watch(
    () => world.map,
    () => {
      swaps.count += 1;
    },
    { flush: 'sync' },
  );
  return swaps;
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

function freeNeighbours(map: HexMapModel, from: { columnIndex: number; rowIndex: number }) {
  return getHexNeighbors(from).filter((at) => {
    const tile = map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(at));
    return tile?.terrain === 'ground' && !tile.hexobject && !tile.exit;
  });
}

describe('REQ-2: overlapping map swaps, the latest request wins', () => {
  beforeEach(() => {
    route.current = null;
  });

  it('drops a retry that finishes after the hero was shown another location', async () => {
    const { world } = start();
    fakeStandIn('silesia');
    forgetServerWorld('silesia');
    world.goToLocation('silesia');
    expect(world.worldLoadFailed).toBe(true);
    const gate = deferred<void>();
    const post = vi.mocked(apiClient.post).getMockImplementation()!;
    vi.mocked(apiClient.post).mockImplementation(async (...args) => {
      await gate.promise;
      return post(...args);
    });

    const retry = world.retryWorldLoad();
    fakeStandIn('camping');
    world.goToLocation('camping');
    const shown = world.map;
    gate.resolve();
    await retry;

    expect(world.currentLocationKey).toBe('camping');
    expect(world.map).toBe(shown);
  });

  it('keeps the second of two refetched maps when the first answer arrives last', async () => {
    const { world, hero } = start();
    fakeStandIn('silesia');
    world.goToLocation('silesia');
    const mapId = world.currentMapId!;
    const [older, newer] = freeNeighbours(world.map as HexMapModel, fakePresence()!.coordinates);
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    vi.mocked(apiClient.get)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    world.applyWorldResult(replayedAnswer(mapId));
    world.applyWorldResult(replayedAnswer(mapId));
    fakePlaceHero(newer);
    second.resolve(fakeWorldSnapshot());
    await settle();
    fakePlaceHero(older);
    first.resolve(fakeWorldSnapshot());
    await settle();

    expect(hero.heroCoordinates).toEqual(newer);
  });
});

function mountWorldScene(routeKey: Ref<LocationKey | undefined>) {
  const world = useWorldMapStore();
  const swaps = countMapSwaps(world);
  const app = createApp(
    defineComponent({
      setup() {
        usePresenceRoute(() => routeKey.value);
        onMounted(() => world.bootstrapWorld());
        return () => null;
      },
    }),
  );
  app.mount(document.createElement('div'));
  return { app, swaps };
}

describe('REQ-3: opening the world scene loads the map once', () => {
  it('when the link names the location the hero stands in', async () => {
    const { world } = start();
    fakeStandIn('silesia');
    const routeKey = ref<LocationKey | undefined>('silesia');
    route.current = routeKey;

    const { app, swaps } = mountWorldScene(routeKey);
    await nextTick();

    expect(world.currentLocationKey).toBe('silesia');
    expect(world.currentMapId).not.toBeNull();
    expect(swaps.count).toBe(1);
    app.unmount();
  });

  it('when the link names another location and the route is replaced', async () => {
    const { world } = start();
    fakeStandIn('silesia');
    const routeKey = ref<LocationKey | undefined>('cave');
    route.current = routeKey;

    const { app, swaps } = mountWorldScene(routeKey);
    await settle();

    expect(routeKey.value).toBe('silesia');
    expect(world.currentLocationKey).toBe('silesia');
    expect(swaps.count).toBe(1);
    app.unmount();
  });
});
