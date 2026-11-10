import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { hexDistance } from '../utils/hex-utils';
import { createServerWorld } from './server-world';
import { applyWorldFixture, worldFixtureSchema } from './world-fixtures';

describe('world fixtures', () => {
  it('places an object on a free hex next to the hero and reports the changed tile', () => {
    const world = createServerWorld('camping', 'map-1', 'seed', 'hero-1');
    const placed = applyWorldFixture(world, {
      kind: 'place-hexobject',
      key: HEXOBJECT_KEYS.HEALTH_BOTTLE,
    })!;
    expect(hexDistance(placed.coordinates, world.heroCoordinates!)).toBe(1);
    expect(placed.tileDiffs).toHaveLength(1);
    const tile = world.map.tiles.find(
      (t) =>
        t.coordinates.columnIndex === placed.coordinates.columnIndex &&
        t.coordinates.rowIndex === placed.coordinates.rowIndex,
    );
    expect(tile?.hexobject?.hexobjectKey).toBe(HEXOBJECT_KEYS.HEALTH_BOTTLE);
  });

  it('does nothing for a hero who stands nowhere', () => {
    const world = createServerWorld('camping', 'map-1', 'seed', 'hero-1');
    world.heroCoordinates = null;
    expect(
      applyWorldFixture(world, { kind: 'place-hexobject', key: HEXOBJECT_KEYS.HEALTH_BOTTLE }),
    ).toBeNull();
  });

  it('refuses an unknown object key and extra fields', () => {
    expect(worldFixtureSchema.safeParse({ kind: 'place-hexobject', key: 'nope' }).success).toBe(
      false,
    );
    expect(
      worldFixtureSchema.safeParse({
        kind: 'place-hexobject',
        key: HEXOBJECT_KEYS.HAND,
        extra: 1,
      }).success,
    ).toBe(false);
  });
});
