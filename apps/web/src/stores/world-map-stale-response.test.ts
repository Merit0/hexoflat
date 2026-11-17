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
import { PlayerSocket } from '@/services/player/player-socket';
import type { PlayerEnvelope } from '@/services/player/player-socket';
import { inventorySession } from '@/services/inventory/inventory-session';
import { onMapMismatch } from '@/services/world/presence-location';
import { usePresenceRoute } from '@/composables/use-presence-route';
import { readCachedWorld } from '@/services/world/served-world';
import { cachedWorldJson } from '@/services/player/world-sync';
import { apiClient } from '@/api/client';
import {
  fakePresence,
  fakeProgressRow,
  fakeStoreWorld,
  fakeStoredWorld,
  sentCommands,
} from '@/test-support/fake-player-server';
import { holdServedWorld, fakeStandIn, seedFakeSession } from '@/test-support/fake-session';
import { useHeroStore } from './hero-store';
import { useHeroToolStore } from './hero-tool-store';
import { useWorldMapStore } from './world-map-store';

vi.mock('@/services/player/player-socket', async () =>
  (await import('@/test-support/fake-player-server')).fakePlayerSocketModule(),
);
vi.mock('@/services/world/location-navigator', () => ({
  navigateToLocation: vi.fn(),
  isViewingOtherWorldLocation: vi.fn(() => false),
  routeToLocation: vi.fn(async () => {}),
  replaceLocationRoute: vi.fn(async () => {}),
}));

const HERO = 'hero-1';

const fog = (map: HexMapModel) =>
  map.tiles.filter((tile) => !tile.isRevealed).map((tile) => tile.coordinates);

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

function moveServerPresence(mapId: string) {
  fakeProgressRow().state.presence = { ...fakePresence()!, mapId };
}

function answerAfterMapChange(type: string, change: () => void) {
  const original = Reflect.get(PlayerSocket.prototype, 'sendWorld');
  return vi.spyOn(PlayerSocket.prototype, 'sendWorld').mockImplementation(async function (
    this: PlayerSocket,
    envelope: PlayerEnvelope,
  ) {
    const answer = await original.call(this, envelope);
    if (envelope.command.type === type) change();
    return answer;
  });
}

function ensureRequests(): string[] {
  return vi
    .mocked(apiClient.post)
    .mock.calls.filter(([path]) => path === '/player/world/ensure')
    .map(([, body]) => (body as { locationKey: string }).locationKey);
}

function stepsSent(): string[] {
  return sentCommands
    .filter((sent) => sent.command.type === 'WORLD_STEP')
    .map((sent) => (sent.command.payload as { expectedMapId: string }).expectedMapId);
}

function remakeServerSilesia(mapId: string) {
  const remade = createServerWorld('silesia', mapId, `${mapId}-seed`, HERO);
  fakeStoreWorld(remade);
  fakeStandIn('silesia');
  return remade;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('an answer for a map the client no longer shows (MAPFIX-2)', () => {
  const mismatches = vi.fn();

  beforeEach(() => {
    mismatches.mockReset();
    onMapMismatch(mismatches);
    vi.restoreAllMocks();
    vi.stubGlobal('navigator', { locks: { request: (_key: string, run: () => unknown) => run() } });
  });

  it('sends the shown map id with every world command', async () => {
    const { hero, world, map } = inSilesia();
    await hero.moveHeroTo(walkableNeighbour(map, hero.heroCoordinates!));
    const step = sentCommands.find((sent) => sent.command.type === 'WORLD_STEP')!;
    expect(step.command.payload).toMatchObject({ expectedMapId: world.currentMapId });
  });

  it('REQ-4: drops a step answer that arrives after the map changed; the store stays as it is', async () => {
    const { hero, world, map } = inSilesia();
    const target = walkableNeighbour(map, hero.heroCoordinates!);
    const silesiaFog = fog(map);
    const camp = readCachedWorld('camping')!;
    answerAfterMapChange('WORLD_STEP', () => world.goToLocation('camping'));

    const moved = await hero.moveHeroTo(target);

    expect(fakeStoredWorld('silesia-map')!.heroCoordinates).toEqual(target);
    expect(moved).toBe(false);
    expect(world.currentLocationKey).toBe('camping');
    expect(world.currentMapId).toBe(camp.mapId);
    expect(fog(world.map as HexMapModel)).toEqual(fog(camp.map));
    expect(fog(map)).toEqual(silesiaFog);
    expect(hero.heroCoordinates).toEqual(camp.heroCoordinates);
    expect(hero.hero.heroSteps).toBe(0);
    expect(useHeroToolStore().actionMessage).toBeNull();
    expect(mismatches).not.toHaveBeenCalled();
  });

  it('REQ-4: drops an action answer that names another map than the one shown', () => {
    const { world, map } = inSilesia();
    const tile = map.tiles.find((t) => t.isRevealed && !t.hexobject && t.terrain === 'ground')!;
    const before = map.toJSON();
    const raw = before.tiles.find(
      (t) =>
        t.coordinates.columnIndex === tile.coordinates.columnIndex &&
        t.coordinates.rowIndex === tile.coordinates.rowIndex,
    )!;
    world.applyWorldResult({
      ok: true,
      mapId: 'left-map',
      tileDiffs: [{ coordinates: tile.coordinates, tile: { ...raw, isRevealed: false } }],
      events: [],
      effects: [{ kind: 'log', source: 'test', text: 'stale' }],
      engagement: null,
      steps: [],
      serverNowMs: null,
    } as never);
    expect(map.toJSON()).toEqual(before);
  });

  it('REQ-5: a step refused with MAP_MISMATCH is not repeated, and the walk stops', async () => {
    const { hero, map } = inSilesia();
    const first = walkableNeighbour(map, hero.heroCoordinates!);
    const second = walkableNeighbour(map, first);
    moveServerPresence('moved-on-server');
    sentCommands.length = 0;

    const moved = await hero.moveHeroTo(second);

    expect(moved).toBe(false);
    expect(sentCommands.map((sent) => sent.command.type)).toEqual(['WORLD_STEP']);
    expect(inventorySession.presence?.mapId).toBe('moved-on-server');
    expect(mismatches).toHaveBeenCalledTimes(1);
    expect(hero.hero.heroSteps).toBe(0);
    expect(useHeroToolStore().actionMessage).toBeNull();
  });

  it('REQ-5: a background tick refused with MAP_MISMATCH does not tick again for that map', async () => {
    const { world, map, hero } = inSilesia();
    const spot = walkableNeighbour(map, hero.heroCoordinates!);
    const served = fakeStoredWorld('silesia-map')!;
    tileOf(served.map, spot)!.hexobject = HexObjectFactory.create(
      HEXOBJECT_KEYS.HEALTH_BOTTLE,
      spot,
    );
    const tile = tileOf(map, spot)!;
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.HEALTH_BOTTLE, spot);
    const started = await world.executeHexAction(tile, EHexActionType.TAKE, HEXOBJECT_KEYS.HAND);
    expect(started.ok).toBe(true);
    tile.pendingAction!.endsAt = Date.now() - 1;
    moveServerPresence('moved-on-server');
    sentCommands.length = 0;

    for (let i = 0; i < 5; i += 1) await world.serverTick();

    expect(sentCommands.map((sent) => sent.command.type)).toEqual(['WORLD_TICK']);
    expect(sentCommands[0].command.payload).toMatchObject({ expectedMapId: 'silesia-map' });
    expect(tile.pendingAction).not.toBeNull();
  });

  it('reloads the map the server holds after a MAP_MISMATCH refusal, and the next step walks on it', async () => {
    const { hero, world, map } = inSilesia();
    const view = showRouteOf('silesia');
    const target = walkableNeighbour(map, hero.heroCoordinates!);
    const remade = createServerWorld('silesia', 'silesia-remade', 'another-seed', HERO);
    fakeStoreWorld(remade);
    fakeStandIn('silesia');
    expect(inventorySession.presence?.mapId).toBe('silesia-remade');
    expect(world.currentMapId).toBe('silesia-map');
    sentCommands.length = 0;

    expect(await hero.moveHeroTo(target)).toBe(false);
    await vi.waitFor(() => expect(world.currentMapId).toBe('silesia-remade'));
    expect(hero.heroCoordinates).toEqual(remade.heroCoordinates);

    const next = walkableNeighbour(world.map as HexMapModel, hero.heroCoordinates!);
    expect(await hero.moveHeroTo(next)).toBe(true);
    expect(
      sentCommands
        .filter((sent) => sent.command.type === 'WORLD_STEP')
        .map((sent) => (sent.command.payload as { expectedMapId: string }).expectedMapId),
    ).toEqual(['silesia-map', 'silesia-remade']);
    view.unmount();
  });

  it('REQ-6: a MAP_MISMATCH refusal reloads the world exactly once and the refused step is not sent again', async () => {
    const { hero, world, map } = inSilesia();
    const view = showRouteOf('silesia');
    const target = walkableNeighbour(map, hero.heroCoordinates!);
    remakeServerSilesia('silesia-remade');
    sentCommands.length = 0;
    vi.mocked(apiClient.post).mockClear();

    expect(await hero.moveHeroTo(target)).toBe(false);
    await vi.waitFor(() => expect(world.currentMapId).toBe('silesia-remade'));
    await settle();

    expect(ensureRequests()).toEqual(['silesia']);
    expect(stepsSent()).toEqual(['silesia-map']);
    expect(world.worldLoadFailed).toBe(false);
    view.unmount();
  });

  it('REQ-7: a second MAP_MISMATCH after the reload shows the world load error and reloads no more', async () => {
    const { hero, world, map } = inSilesia();
    const view = showRouteOf('silesia');
    remakeServerSilesia('silesia-remade');
    expect(await hero.moveHeroTo(walkableNeighbour(map, hero.heroCoordinates!))).toBe(false);
    await vi.waitFor(() => expect(world.currentMapId).toBe('silesia-remade'));
    remakeServerSilesia('silesia-third');
    sentCommands.length = 0;
    vi.mocked(apiClient.post).mockClear();

    const next = walkableNeighbour(world.map as HexMapModel, hero.heroCoordinates!);
    expect(await hero.moveHeroTo(next)).toBe(false);
    await vi.waitFor(() => expect(world.worldLoadFailed).toBe(true));
    await settle();

    expect(world.map).toBeNull();
    expect(world.currentLocationKey).toBe('silesia');
    expect(ensureRequests()).toEqual([]);
    expect(stepsSent()).toEqual(['silesia-remade']);
    view.unmount();
  });

  it('REQ-8: a dropped stale step evicts the cached document of its location, and the next entry there asks the server', async () => {
    const { hero, world, map } = inSilesia();
    const target = walkableNeighbour(map, hero.heroCoordinates!);
    answerAfterMapChange('WORLD_STEP', () => world.goToLocation('camping'));

    expect(await hero.moveHeroTo(target)).toBe(false);
    expect(cachedWorldJson('silesia')).toBeNull();
    expect(cachedWorldJson('camping')).not.toBeNull();
    vi.mocked(apiClient.post).mockClear();

    world.goToLocation('silesia');
    await vi.waitFor(() => expect(world.currentLocationKey).toBe('silesia'));

    expect(ensureRequests()).toEqual(['silesia']);
    expect(world.worldLoadFailed).toBe(false);
    expect(world.currentMapId).toBe('silesia-map');
    expect(hero.heroCoordinates).toEqual(target);
  });

  it('REQ-8: keeps the cached document when its location already shows a newer map', async () => {
    const { hero, world, map } = inSilesia();
    const target = walkableNeighbour(map, hero.heroCoordinates!);
    const remade = createServerWorld('silesia', 'silesia-remade', 'another-seed', HERO);
    answerAfterMapChange('WORLD_STEP', () => {
      holdServedWorld(remade);
      world.swapMap({
        kind: 'served',
        locationKey: 'silesia',
        served: readCachedWorld('silesia')!,
      });
    });

    expect(await hero.moveHeroTo(target)).toBe(false);

    expect(world.currentMapId).toBe('silesia-remade');
    expect(readCachedWorld('silesia')?.mapId).toBe('silesia-remade');
  });
});
