import { describe, expect, it } from 'vitest';
import { emptyProgressState } from '../aggregates/progress-state';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { emptyInventoryState } from '../inventory/inventory-state';
import { countItem } from '../inventory/plan-stock';
import { toAggregate } from '../inventory/inventory-adapter';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { EHexActionType } from '../enums/hex-action-type';
import { EHexCollision } from '../abstraction/hexobject-abstraction';
import { getHexNeighbors } from '../utils/hex-utils';
import {
  actWorld,
  createServerWorld,
  deserializeWorld,
  serializeWorld,
  stepWorld,
  tickWorld,
  type ServerWorld,
  type WorldRun,
} from './index';

const HERO = 'hero-1';
const SEED = 'expedition-seed';

function withoutImages(world: ServerWorld) {
  const json = serializeWorld(world);
  return JSON.stringify({
    ...json,
    map: { ...json.map, tiles: json.map.tiles.map((tile) => ({ ...tile, imagePath: '' })) },
  });
}

function run(world: ServerWorld, now = 1_000): WorldRun {
  return {
    world,
    progress: emptyProgressState(HERO),
    inventory: emptyInventoryState(HERO),
    heroId: HERO,
    now,
  };
}

function neighbours(world: ServerWorld) {
  return getHexNeighbors(world.heroCoordinates!);
}

describe('a world the server builds', () => {
  it('is the same world for the same expedition seed and map, and another for another seed', () => {
    const a = createServerWorld('cave', 'map-1', SEED, HERO);
    const b = createServerWorld('cave', 'map-1', SEED, HERO);
    const c = createServerWorld('cave', 'map-1', 'another-seed', HERO);
    expect(withoutImages(a)).toBe(withoutImages(b));
    expect(withoutImages(a)).not.toBe(withoutImages(c));
  });

  it('puts the hero at the entry with fog around him, and installs the camp Book', () => {
    const camp = createServerWorld('camping', 'map-camp', SEED, HERO);
    expect(camp.heroCoordinates).not.toBeNull();
    expect(camp.map.tiles.some((tile) => tile.isRevealed)).toBe(true);
    const silesia = createServerWorld('silesia', 'map-fog', SEED, HERO);
    const revealed = silesia.map.tiles.filter((tile) => tile.isRevealed).length;
    expect(revealed).toBeGreaterThan(0);
    expect(revealed).toBeLessThan(silesia.map.tiles.length);
    expect(
      camp.map.tiles.some((tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.KNOWLEDGE_BOOK),
    ).toBe(true);
  });

  it('survives being saved and loaded', () => {
    const world = createServerWorld('silesia', 'map-s', SEED, HERO);
    const back = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(world))), 0);
    expect(back.heroCoordinates).toEqual(world.heroCoordinates);
    expect(back.map.tiles).toHaveLength(world.map.tiles.length);
    expect(withoutImages(back)).toBe(withoutImages(world));
  });

  it('refuses a document of another content version', () => {
    const world = createServerWorld('silesia', 'map-s', SEED, HERO);
    expect(() => deserializeWorld({ ...serializeWorld(world), contentVersion: 999 }, 0)).toThrow();
  });
});

describe('a step on the server map', () => {
  const free = (world: ServerWorld) =>
    neighbours(world).find((hex) => {
      const tile = world.map.tiles.find(
        (t) =>
          t.coordinates.columnIndex === hex.columnIndex && t.coordinates.rowIndex === hex.rowIndex,
      );
      return tile?.isRevealed && !tile.hexobject && tile.terrain === 'ground';
    });

  it('moves the hero, reveals what he now sees, reports only the tiles that changed and counts the step', () => {
    const world = createServerWorld('silesia', 'map-1', SEED, HERO);
    const target = free(world);
    expect(target).toBeDefined();
    const outcome = stepWorld(run(world), target!);
    if (!outcome.ok) throw new Error(outcome.code);
    expect(outcome.world.heroCoordinates).toEqual(target);
    expect(outcome.progress.steps).toBe(1);
    expect(outcome.progress.knowledge.current).toBe(19);
    expect(outcome.tileDiffs.length).toBeGreaterThan(0);
    expect(outcome.tileDiffs.length).toBeLessThan(outcome.world.map.tiles.length / 4);
    expect(outcome.tileDiffs.every((diff) => diff.tile.isRevealed)).toBe(true);
  });

  it('does not charge in the camp', () => {
    const world = createServerWorld('camping', 'map-c', SEED, HERO);
    const target = free(world)!;
    const outcome = stepWorld(run(world), target);
    if (!outcome.ok) throw new Error(outcome.code);
    expect(outcome.progress.knowledge.current).toBe(20);
  });

  it.each([
    ['a hex that is not a neighbour', { columnIndex: 3, rowIndex: 9 }, 'INVALID_STEP'],
    ['the hex he stands on', null, 'INVALID_STEP'],
  ])('refuses %s and changes nothing', (_name, target, code) => {
    const world = createServerWorld('silesia', 'map-1', SEED, HERO);
    const before = withoutImages(world);
    const outcome = stepWorld(run(world), target ?? world.heroCoordinates!);
    expect(outcome).toMatchObject({ ok: false, code });
    expect(withoutImages(world)).toBe(before);
  });

  it('refuses a hex that is solid or still hidden', () => {
    const world = createServerWorld('silesia', 'map-1', SEED, HERO);
    const blocked = neighbours(world).find((hex) => {
      const tile = world.map.tiles.find(
        (t) =>
          t.coordinates.columnIndex === hex.columnIndex && t.coordinates.rowIndex === hex.rowIndex,
      );
      return (
        !!tile &&
        (!tile.isRevealed ||
          tile.hexobject?.collision === EHexCollision.SOLID ||
          tile.terrain !== 'ground')
      );
    });
    if (!blocked) return;
    expect(stepWorld(run(world), blocked)).toMatchObject({ ok: false });
  });

  it('refuses with too little Will and leaves the hero where he was', () => {
    const world = createServerWorld('silesia', 'map-1', SEED, HERO);
    const poor = run(world);
    poor.progress.knowledge.current = 0;
    const outcome = stepWorld(poor, free(world)!);
    expect(outcome).toMatchObject({ ok: false, code: 'INSUFFICIENT_WILL' });
    expect(world.heroCoordinates).not.toBeNull();
  });
});

describe('an action on the server map', () => {
  function worldWithBottle() {
    const world = createServerWorld('camping', 'map-c', SEED, HERO);
    const spot = neighbours(world).find((hex) => {
      const tile = world.map.tiles.find(
        (t) =>
          t.coordinates.columnIndex === hex.columnIndex && t.coordinates.rowIndex === hex.rowIndex,
      );
      return !!tile && !tile.hexobject && tile.terrain === 'ground';
    })!;
    const tile = world.map.tiles.find(
      (t) =>
        t.coordinates.columnIndex === spot.columnIndex && t.coordinates.rowIndex === spot.rowIndex,
    )!;
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.HEALTH_BOTTLE, spot);
    tile.isRevealed = true;
    return { world, spot };
  }

  const take = (spot: { columnIndex: number; rowIndex: number }) => ({
    heroId: HERO,
    coordinates: spot,
    actionType: EHexActionType.TAKE,
    toolKey: HEXOBJECT_KEYS.HAND,
    now: 1_000,
  });

  it('starts, finishes by the server clock and puts the loot into the inventory that was passed in', () => {
    const { world, spot } = worldWithBottle();
    const started = actWorld(run(world), take(spot));
    if (!started.ok) throw new Error(started.code);
    expect(started.events.some((e) => e.type === 'HEX_ACTION_STARTED')).toBe(true);
    expect(countItem(toAggregate(started.inventory), HEXOBJECT_KEYS.HEALTH_BOTTLE)).toBe(0);

    const later = tickWorld({
      ...run(started.world, 60_000),
      inventory: started.inventory,
      progress: started.progress,
    });
    if (!later.ok) throw new Error(later.code);
    expect(countItem(toAggregate(later.inventory), HEXOBJECT_KEYS.HEALTH_BOTTLE)).toBe(1);
    expect(
      later.world.map.tiles.find(
        (t) =>
          t.coordinates.columnIndex === spot.columnIndex &&
          t.coordinates.rowIndex === spot.rowIndex,
      )?.hexobject,
    ).toBeNull();
    expect(later.tileDiffs.length).toBeGreaterThan(0);
  });

  it('does nothing before the action is due', () => {
    const { world, spot } = worldWithBottle();
    const started = actWorld(run(world), take(spot));
    if (!started.ok) throw new Error(started.code);
    const early = tickWorld({
      ...run(started.world, 1_001),
      inventory: started.inventory,
      progress: started.progress,
    });
    if (!early.ok) throw new Error(early.code);
    expect(countItem(toAggregate(early.inventory), HEXOBJECT_KEYS.HEALTH_BOTTLE)).toBe(0);
  });

  it('refuses a hex that is not beside the hero, with nothing changed', () => {
    const { world } = worldWithBottle();
    const far = { columnIndex: 0, rowIndex: 0 };
    expect(actWorld(run(world), take(far))).toMatchObject({ ok: false, code: 'TOO_FAR' });
  });

  it('refuses an action the tile does not offer', () => {
    const { world, spot } = worldWithBottle();
    const outcome = actWorld(run(world), { ...take(spot), actionType: EHexActionType.MINE });
    expect(outcome).toMatchObject({ ok: false });
  });
});
