import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createServerWorld, serializeWorld } from '@hexoflat/engine';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { sentCommands } from '@/test-support/fake-player-server';
import { seedFakeSession } from '@/test-support/fake-session';
import { cacheServerWorld } from '@/services/player/world-sync';
import { useHeroStore } from './hero-store';
import { useWorldMapStore } from './world-map-store';

vi.mock('@/services/player/player-socket', async () =>
  (await import('@/test-support/fake-player-server')).fakePlayerSocketModule(),
);
vi.mock('@/services/world/location-navigator', () => ({
  navigateToLocation: vi.fn(),
  isViewingOtherWorldLocation: vi.fn(() => false),
  routeToLocation: vi.fn(async () => {}),
}));

const HERO = 'hero-1';

function setup() {
  setActivePinia(createPinia());
  const hero = useHeroStore();
  hero.hero.id = HERO;
  seedFakeSession(HERO);
  hero.loadKnowledge();
  const served = createServerWorld('silesia', 'served-map', 'expedition-seed', HERO);
  cacheServerWorld('silesia', served.mapId, JSON.stringify(serializeWorld(served)));
  return { hero, world: useWorldMapStore(), served };
}

describe('a world the server holds', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { locks: { request: (_key: string, run: () => unknown) => run() } });
  });

  it('is loaded from the server copy: same map id, same hero place, no local generation', () => {
    const { hero, world, served } = setup();
    world.goToLocation('silesia');
    expect(world.currentMapId).toBe('served-map');
    expect(hero.heroCoordinates).toEqual(served.heroCoordinates);
    expect(world.map?.tiles.map((t) => t.hexobject?.hexobjectKey ?? null)).toEqual(
      served.map.tiles.map((t) => t.hexobject?.hexobjectKey ?? null),
    );
  });

  it('walks one hex through WORLD_STEP and takes the fog from the server, without ARRIVE', async () => {
    const { hero, world, served } = setup();
    world.goToLocation('silesia');
    const here = hero.heroCoordinates!;
    const target = getHexNeighbors(here).find((hex) => {
      const tile = world.map?.tiles.find(
        (t) =>
          t.coordinates.columnIndex === hex.columnIndex && t.coordinates.rowIndex === hex.rowIndex,
      );
      return !!tile && tile.isRevealed && !tile.hexobject && tile.terrain === 'ground';
    })!;
    const hiddenBefore = world.map!.tiles.filter((t) => !t.isRevealed).length;
    expect(served.map.tiles.filter((t) => !t.isRevealed).length).toBe(hiddenBefore);

    const moved = await hero.moveHeroTo(target);

    expect(moved).toBe(true);
    expect(hero.heroCoordinates).toEqual(target);
    expect(hero.hero.heroSteps).toBe(1);
    expect(world.map!.tiles.filter((t) => !t.isRevealed).length).toBeLessThan(hiddenBefore);
    const types = sentCommands.map((c) => c.command.type);
    expect(types).toContain('WORLD_STEP');
    expect(types).not.toContain('ARRIVE');
  });

  it('does not move the hero when the server refuses the step', async () => {
    const { hero, world } = setup();
    world.goToLocation('silesia');
    const here = { ...hero.heroCoordinates! };
    const refused = await world.stepOnServer({ columnIndex: 250, rowIndex: 250 });
    expect(refused).toMatchObject({ ok: false });
    expect(sentCommands.some((c) => c.command.type === 'WORLD_STEP')).toBe(true);
    expect(hero.heroCoordinates).toEqual(here);
  });
});
