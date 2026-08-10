import { describe, expect, it } from 'vitest';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey } from '../utils/hex-utils';
import { isEnterableTile, planCombatRoute } from './move-planner';

function buildRevealedMap(width = 5, height = 5) {
  const map = new HexMapBuilder().name('move-planner').width(width).height(height).build();
  for (const tile of map.tiles) tile.isRevealed = true;
  return map;
}

function placeAt(
  map: ReturnType<typeof buildRevealedMap>,
  coord: { columnIndex: number; rowIndex: number },
  key: string,
) {
  const tile = map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(coord))!;
  tile.hexobject = HexObjectFactory.create(key as never, coord);
}

describe('isEnterableTile', () => {
  it('accepts a revealed, empty tile', () => {
    expect(isEnterableTile(buildRevealedMap(), { columnIndex: 1, rowIndex: 1 })).toBe(true);
  });

  it('rejects a tile the hero has not revealed yet', () => {
    const map = buildRevealedMap();
    const target = { columnIndex: 1, rowIndex: 1 };
    map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(target))!.isRevealed =
      false;

    expect(isEnterableTile(map, target)).toBe(false);
  });

  it('rejects a tile occupied by something solid', () => {
    const map = buildRevealedMap();
    const target = { columnIndex: 1, rowIndex: 1 };
    placeAt(map, target, HEXOBJECT_KEYS.ROCK);

    expect(isEnterableTile(map, target)).toBe(false);
  });

  it('rejects the camp entrance, which is a transition rather than a destination', () => {
    const map = buildRevealedMap();
    const target = { columnIndex: 1, rowIndex: 1 };
    placeAt(map, target, HEXOBJECT_KEYS.CAMPING_ENTRANCE);

    expect(isEnterableTile(map, target)).toBe(false);
  });

  it('rejects a tile that is not on the map at all', () => {
    expect(isEnterableTile(buildRevealedMap(), { columnIndex: 99, rowIndex: 99 })).toBe(false);
  });
});

describe('planCombatRoute', () => {
  const from = { columnIndex: 0, rowIndex: 0 };

  it("returns the route without the hero's own tile", () => {
    const map = buildRevealedMap();

    const route = planCombatRoute(map, from, { columnIndex: 1, rowIndex: 0 }, 3)!;

    expect(route).not.toBeNull();
    expect(coordinateKey(route[0])).not.toBe(coordinateKey(from));
    expect(coordinateKey(route[route.length - 1])).toBe(
      coordinateKey({ columnIndex: 1, rowIndex: 0 }),
    );
  });

  it('refuses a target beyond the step budget', () => {
    const map = buildRevealedMap();

    expect(planCombatRoute(map, from, { columnIndex: 4, rowIndex: 4 }, 1)).toBeNull();
  });

  it('refuses to plan anything with no steps left', () => {
    const map = buildRevealedMap();

    expect(planCombatRoute(map, from, { columnIndex: 1, rowIndex: 0 }, 0)).toBeNull();
  });

  it('refuses a target that cannot be reached at all', () => {
    const map = buildRevealedMap();

    expect(planCombatRoute(map, from, { columnIndex: 99, rowIndex: 99 }, 5)).toBeNull();
  });

  it('never returns a route longer than the budget', () => {
    const map = buildRevealedMap();

    const route = planCombatRoute(map, from, { columnIndex: 2, rowIndex: 0 }, 2);

    expect(route!.length).toBeLessThanOrEqual(2);
  });
});
