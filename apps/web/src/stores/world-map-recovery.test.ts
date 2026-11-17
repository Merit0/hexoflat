import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createApp, defineComponent } from 'vue';
import { createServerWorld } from '@hexoflat/engine';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { inventorySession } from '@/services/inventory/inventory-session';
import { sendWorldCommand } from '@/services/inventory/inventory-sync';
import { usePresenceRoute } from '@/composables/use-presence-route';
import { cachedWorldJson } from '@/services/player/world-sync';
import { apiClient } from '@/api/client';
import {
  fakeEnsureWorld,
  fakeStoreWorld,
  fakeStoredWorld,
  fakeStoredWorldOf,
  sentCommands,
} from '@/test-support/fake-player-server';
import { holdServedWorld, fakeStandIn, seedFakeSession } from '@/test-support/fake-session';
import { useHeroStore } from './hero-store';
import { useWorldMapStore } from './world-map-store';

vi.mock('@/services/player/player-socket', async () =>
  (await import('@/test-support/fake-player-server')).fakePlayerSocketModule(),
);
vi.mock('@/services/world/location-navigator', () => ({
  navigateToLocation: vi.fn(),
  isViewingOtherWorldLocation: vi.fn(() => false),
  isViewingWorldLocation: vi.fn(() => true),
  routeToLocation: vi.fn(async () => {}),
  replaceLocationRoute: vi.fn(async () => {}),
}));

const HERO = 'hero-1';

const tileOf = (map: HexMapModel, at: IHexCoordinates) =>
  map.tiles.find(
    (tile) =>
      tile.coordinates.columnIndex === at.columnIndex && tile.coordinates.rowIndex === at.rowIndex,
  );

function walkableNeighbour(map: HexMapModel, from: IHexCoordinates): IHexCoordinates {
  return getHexNeighbors(from).find((hex) => {
    const tile = tileOf(map, hex);
    return !!tile && tile.isRevealed && !tile.hexobject && tile.terrain === 'ground';
  })!;
}

function inSilesia() {
  setActivePinia(createPinia());
  const hero = useHeroStore();
  hero.hero.id = HERO;
  seedFakeSession(HERO);
  hero.loadKnowledge();
  holdServedWorld(createServerWorld('silesia', 'silesia-map', 'expedition-seed', HERO));
  fakeStandIn('silesia');
  const world = useWorldMapStore();
  world.goToLocation('silesia');
  return { hero, world, map: world.map as HexMapModel };
}

function showRouteOf(locationKey: 'silesia') {
  const app = createApp(
    defineComponent({
      setup() {
        usePresenceRoute(() => locationKey);
        return () => null;
      },
    }),
  );
  app.mount(document.createElement('div'));
  return app;
}

function ensureRequests(): string[] {
  return vi
    .mocked(apiClient.post)
    .mock.calls.filter(([path]) => path === '/player/world/ensure')
    .map(([, body]) => (body as { locationKey: string }).locationKey);
}

function holdHeroInCave(): string {
  fakeEnsureWorld('cave');
  fakeStandIn('cave');
  return fakeStoredWorldOf('cave')!.mapId;
}

function bottleBeside(map: HexMapModel, from: IHexCoordinates) {
  const spot = walkableNeighbour(map, from);
  tileOf(fakeStoredWorld('silesia-map')!.map, spot)!.hexobject = HexObjectFactory.create(
    HEXOBJECT_KEYS.HEALTH_BOTTLE,
    spot,
  );
  const tile = tileOf(map, spot)!;
  tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.HEALTH_BOTTLE, spot);
  return tile;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('recovering the map the server holds (MAPFIX-6)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('navigator', { locks: { request: (_key: string, run: () => unknown) => run() } });
  });

  it('REQ-1: a refetched document of another location never lands under the shown key; the store swaps to it', async () => {
    const { world } = inSilesia();
    const silesiaBefore = cachedWorldJson('silesia');
    const caveId = holdHeroInCave();

    await world.refetchWorld();

    expect(cachedWorldJson('silesia')).toBe(silesiaBefore);
    expect(JSON.parse(cachedWorldJson('cave')!)).toMatchObject({ mapId: caveId });
    expect(world.currentLocationKey).toBe('cave');
    expect(world.currentMapId).toBe(caveId);
    expect(world.worldLoadFailed).toBe(false);
  });

  it('REQ-2: a step refused with HERO_ELSEWHERE is not sent; one reload of the held location follows', async () => {
    const { hero, world, map } = inSilesia();
    const view = showRouteOf('silesia');
    const caveId = holdHeroInCave();
    sentCommands.length = 0;
    vi.mocked(apiClient.post).mockClear();

    expect(await hero.moveHeroTo(walkableNeighbour(map, hero.heroCoordinates!))).toBe(false);
    await vi.waitFor(() => expect(world.currentMapId).toBe(caveId));
    await settle();

    expect(sentCommands.map((sent) => sent.command.type)).toEqual(['WORLD_ENTER']);
    expect(ensureRequests()).toEqual(['cave']);
    expect(world.currentLocationKey).toBe('cave');
    view.unmount();
  });

  it('REQ-2: a hex action refused with HERO_ELSEWHERE is not sent', async () => {
    const { hero, world, map } = inSilesia();
    const tile = bottleBeside(map, hero.heroCoordinates!);
    const view = showRouteOf('silesia');
    holdHeroInCave();
    sentCommands.length = 0;
    vi.mocked(apiClient.post).mockClear();

    const outcome = await world.executeHexAction(tile, EHexActionType.TAKE, HEXOBJECT_KEYS.HAND);
    await settle();

    expect(outcome.ok).toBe(false);
    expect(sentCommands.map((sent) => sent.command.type)).toEqual(['WORLD_ENTER']);
    expect(ensureRequests()).toEqual(['cave']);
    view.unmount();
  });

  it('REQ-3: two MAP_MISMATCH refusals in a row make one recovery request and no error screen', async () => {
    const { world } = inSilesia();
    const view = showRouteOf('silesia');
    fakeStoreWorld(createServerWorld('silesia', 'silesia-remade', 'remade-seed', HERO));
    fakeStandIn('silesia');
    const post = vi.mocked(apiClient.post).getMockImplementation()!;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    vi.mocked(apiClient.post).mockImplementation(async (path, body) => {
      await gate;
      return post(path, body);
    });
    vi.mocked(apiClient.post).mockClear();

    const stale = { expectedMapId: 'silesia-map', target: { columnIndex: 0, rowIndex: 0 } };
    const answers = await Promise.all([
      sendWorldCommand('WORLD_STEP', stale),
      sendWorldCommand('WORLD_STEP', stale),
    ]);
    release();
    await vi.waitFor(() => expect(world.currentMapId).toBe('silesia-remade'));
    await settle();

    expect(answers.map((answer) => answer.code)).toEqual(['MAP_MISMATCH', 'MAP_MISMATCH']);
    expect(ensureRequests()).toEqual(['silesia']);
    expect(world.worldLoadFailed).toBe(false);
    view.unmount();
  });

  it('REQ-4: a background tick with no server presence sends nothing', async () => {
    const { hero, world, map } = inSilesia();
    const tile = bottleBeside(map, hero.heroCoordinates!);
    expect((await world.executeHexAction(tile, EHexActionType.TAKE, HEXOBJECT_KEYS.HAND)).ok).toBe(
      true,
    );
    tile.pendingAction!.endsAt = Date.now() - 1;
    inventorySession.presence = null;
    sentCommands.length = 0;
    vi.mocked(apiClient.post).mockClear();
    vi.mocked(apiClient.get).mockClear();

    await world.serverTick();

    expect(sentCommands).toEqual([]);
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(tile.pendingAction).not.toBeNull();
  });
});
