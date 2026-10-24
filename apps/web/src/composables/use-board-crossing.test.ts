import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { coordinateKey, hexDistance } from '@hexoflat/engine/utils/hex-utils';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useHeroStore } from '@/stores/hero-store';
import { useCombatStore } from '@/stores/combat-store';
import { crossExitIfStanding } from './use-board-crossing';

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

describe('crossExitIfStanding', () => {
  beforeEach(() => {
    localStorage.clear();
    routeToLocationMock.mockReset();
    setActivePinia(createPinia());
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
    useHeroStore().heroCoordinates = { ...exitTile('N').coordinates };

    expect(await crossExitIfStanding()).toBe(true);

    expect(world.currentLocationKey).toBe('silesia-north');
    expect(routeToLocationMock).toHaveBeenCalledWith('silesia-north');
    const hero = useHeroStore().heroCoordinates!;
    expect(hexDistance(hero, exitTile('S').coordinates)).toBe(1);
    expect(world.pendingArrivalSide).toBeNull();
  });

  it('brings the hero back beside the north exit and remembers the way it left', async () => {
    const world = useWorldMapStore();
    const hero = useHeroStore();
    hero.heroCoordinates = { ...exitTile('N').coordinates };
    await crossExitIfStanding();

    hero.heroCoordinates = { ...exitTile('S').coordinates };
    expect(await crossExitIfStanding()).toBe(true);

    expect(world.currentLocationKey).toBe('silesia');
    expect(hexDistance(hero.heroCoordinates, exitTile('N').coordinates)).toBe(1);
    expect(coordinateKey(hero.heroCoordinates)).not.toBe(coordinateKey(exitTile('N').coordinates));
  });

  it('keeps the hero in place while a combat is running', async () => {
    const world = useWorldMapStore();
    useHeroStore().heroCoordinates = { ...exitTile('N').coordinates };
    useCombatStore().combatActive = true;

    expect(await crossExitIfStanding()).toBe(false);
    expect(world.currentLocationKey).toBe('silesia');
  });

  it('a sealed neighbour changes nothing: hero stays on the exit, no arrival side, no routing', async () => {
    const world = useWorldMapStore();
    const hero = useHeroStore();
    const onExit = { ...exitTile('N').coordinates };
    hero.heroCoordinates = { ...onExit };
    vi.spyOn(world, 'isLocationRespawning').mockReturnValue(true);

    expect(await crossExitIfStanding()).toBe(false);

    expect(hero.heroCoordinates).toEqual(onExit);
    expect(world.pendingArrivalSide).toBeNull();
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
