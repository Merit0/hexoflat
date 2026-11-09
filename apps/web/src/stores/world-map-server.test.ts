import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createServerWorld, serializeWorld } from '@hexoflat/engine';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import { useHeroInventoryStore } from './hero-inventory-store';
import { useHeroToolStore } from './hero-tool-store';
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

describe('actions and ticks through the server', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { locks: { request: (_key: string, run: () => unknown) => run() } });
  });

  function withBottle() {
    setActivePinia(createPinia());
    const hero = useHeroStore();
    hero.hero.id = HERO;
    seedFakeSession(HERO);
    hero.loadKnowledge();
    const served = createServerWorld('camping', 'camp-map', 'expedition-seed', HERO);
    const spot = getHexNeighbors(served.heroCoordinates!).find((hex) => {
      const tile = served.map.tiles.find(
        (t) =>
          t.coordinates.columnIndex === hex.columnIndex && t.coordinates.rowIndex === hex.rowIndex,
      );
      return !!tile && !tile.hexobject && tile.terrain === 'ground';
    })!;
    const tile = served.map.tiles.find(
      (t) =>
        t.coordinates.columnIndex === spot.columnIndex && t.coordinates.rowIndex === spot.rowIndex,
    )!;
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.HEALTH_BOTTLE, spot);
    tile.isRevealed = true;
    cacheServerWorld('camping', served.mapId, JSON.stringify(serializeWorld(served)));
    const world = useWorldMapStore();
    world.goToLocation('camping');
    return { hero, world, tile: world.getTileAt(spot)!, spot };
  }

  it('starts an action on the server, locks the tool from the recorded effect and sends no SPEND_WILL', async () => {
    const { world, tile } = withBottle();
    const tool = useHeroToolStore();
    const outcome = await world.executeHexAction(tile, EHexActionType.TAKE, HEXOBJECT_KEYS.HAND);
    expect(outcome.ok).toBe(true);
    expect(tool.isLocked).toBe(true);
    expect(tile.pendingAction?.type).toBe(EHexActionType.TAKE);
    const types = sentCommands.map((c) => c.command.type);
    expect(types).toContain('WORLD_ACTION');
    expect(types).not.toContain('SPEND_WILL');
  });

  it('finishes the action with a server tick: the loot reaches the bag and the tool is freed', async () => {
    const { world, tile } = withBottle();
    const tool = useHeroToolStore();
    await world.executeHexAction(tile, EHexActionType.TAKE, HEXOBJECT_KEYS.HAND);
    tile.pendingAction!.endsAt = Date.now() - 1;
    await world.serverTick();
    expect(sentCommands.some((c) => c.command.type === 'WORLD_TICK')).toBe(true);
    expect(tool.isLocked).toBe(false);
    expect(tile.hexobject).toBeNull();
    const bag = useHeroInventoryStore();
    expect(bag.items.some((item) => item.key === HEXOBJECT_KEYS.HEALTH_BOTTLE)).toBe(true);
  });

  it('shows the server refusal and leaves the tool free', async () => {
    const { world, tile } = withBottle();
    const tool = useHeroToolStore();
    const outcome = await world.executeHexAction(tile, EHexActionType.CUT, HEXOBJECT_KEYS.HAND);
    expect(outcome.ok).toBe(false);
    expect(tool.isLocked).toBe(false);
  });

  it('heals at a fire from the recorded heal effect while the hand still rests on it', async () => {
    const { hero, world, tile, spot } = withBottle();
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.FIREPLACE, spot);
    const tool = useHeroToolStore();
    hero.hero.maxHealth = 5;
    hero.hero.currentHealth = 2;
    tool.activeTool = HEXOBJECT_KEYS.HAND;
    tool.isDragging = true;
    tool.hover = { ...spot };
    const started = await world.executeHexAction(tile, EHexActionType.USE, HEXOBJECT_KEYS.HAND);
    expect(started.ok).toBe(true);
    tile.pendingAction!.endsAt = Date.now() - 1;
    await world.serverTick();
    expect(hero.hero.currentHealth).toBe(3);
    expect(tool.isLocked).toBe(true);
    tool.isDragging = false;
    tile.pendingAction!.endsAt = Date.now() - 1;
    await world.serverTick();
    expect(hero.hero.currentHealth).toBe(4);
    expect(tool.isLocked).toBe(false);
  });
});
