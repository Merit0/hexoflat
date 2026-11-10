import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { coordinateKey, hexDistance } from '@hexoflat/engine/utils/hex-utils';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useHeroStore } from '@/stores/hero-store';
import { useBattleStore } from '@/stores/battle-store';
import { seedFakeSession } from '@/test-support/fake-session';
import { fakePlaceHero } from '@/test-support/fake-player-server';
import { ensurePresence } from '@/services/inventory/inventory-sync';
import { crossExitIfStanding } from './use-board-crossing';

vi.mock('@/services/player/player-socket', async () =>
  (await import('@/test-support/fake-player-server')).fakePlayerSocketModule(),
);

const { routeToLocationMock } = vi.hoisted(() => ({ routeToLocationMock: vi.fn() }));

vi.mock('@/services/world/location-navigator', () => ({
  routeToLocation: routeToLocationMock,
  navigateToLocation: vi.fn(),
  isViewingOtherWorldLocation: vi.fn(() => false),
}));

function exitTile(side: 'N' | 'S') {
  const tile = useWorldMapStore().map?.tiles.find((candidate) => candidate.exit === side);
  if (!tile) throw new Error(`no ${side} exit`);
  return tile;
}

async function standOn(side: 'N' | 'S') {
  const world = useWorldMapStore();
  const at = { ...exitTile(side).coordinates };
  await ensurePresence({ locationKey: world.currentLocationKey, mapId: world.currentMapId! });
  fakePlaceHero(at);
  useHeroStore().heroCoordinates = at;
}

describe('crossExitIfStanding', () => {
  beforeEach(() => {
    routeToLocationMock.mockReset();
    setActivePinia(createPinia());
    seedFakeSession('hero-cross');
    useWorldMapStore().loadLocationMap('silesia');
  });

  it('does nothing while the hero is not standing on an exit', async () => {
    const world = useWorldMapStore();

    expect(await crossExitIfStanding()).toBe(false);
    expect(world.currentLocationKey).toBe('silesia');
    expect(routeToLocationMock).not.toHaveBeenCalled();
  });

  it('carries a hero standing on the north exit to silesia-north, beside its south exit', async () => {
    const world = useWorldMapStore();
    await standOn('N');

    expect(await crossExitIfStanding()).toBe(true);

    expect(world.currentLocationKey).toBe('silesia-north');
    expect(routeToLocationMock).toHaveBeenCalledWith('silesia-north');
    const hero = useHeroStore().heroCoordinates!;
    expect(hexDistance(hero, exitTile('S').coordinates)).toBe(1);
  });

  it('brings the hero back beside the north exit and remembers the way it left', async () => {
    const world = useWorldMapStore();
    const hero = useHeroStore();
    await standOn('N');
    await crossExitIfStanding();

    await standOn('S');
    expect(await crossExitIfStanding()).toBe(true);

    expect(world.currentLocationKey).toBe('silesia');
    expect(hexDistance(hero.heroCoordinates!, exitTile('N').coordinates)).toBe(1);
    expect(coordinateKey(hero.heroCoordinates!)).not.toBe(coordinateKey(exitTile('N').coordinates));
  });

  it('keeps the hero in place while a battle is open', async () => {
    const world = useWorldMapStore();
    useHeroStore().heroCoordinates = { ...exitTile('N').coordinates };
    useBattleStore().engage({
      squadId: '2:2:lone-skeleton',
      ambush: false,
      heroAt: { columnIndex: 0, rowIndex: 0 },
      heroIds: ['hero'],
      startItems: {},
    });

    expect(await crossExitIfStanding()).toBe(false);
    expect(world.currentLocationKey).toBe('silesia');
  });

  it('a sealed neighbour changes nothing: hero stays on the exit, no routing', async () => {
    const world = useWorldMapStore();
    const hero = useHeroStore();
    const onExit = { ...exitTile('N').coordinates };
    hero.heroCoordinates = { ...onExit };
    vi.spyOn(world, 'isLocationRespawning').mockReturnValue(true);

    expect(await crossExitIfStanding()).toBe(false);

    expect(hero.heroCoordinates).toEqual(onExit);
    expect(world.currentLocationKey).toBe('silesia');
    expect(routeToLocationMock).not.toHaveBeenCalled();
  });

  it('does not cross from a board whose exit has no atlas neighbour', async () => {
    const world = useWorldMapStore();
    world.loadLocationMap('camping');
    useHeroStore().heroCoordinates = { columnIndex: 0, rowIndex: 0 };

    expect(await crossExitIfStanding()).toBe(false);
  });
});
