import { fogInventory } from './hero-fog-test-setup';
import { describe, expect, it } from 'vitest';
import { EQUIPMENT_ATTRIBUTES } from '../content/equipment-attributes.content';
import { EQUIPMENT_TYPES } from '../content/item-types.content';
import { resolveHeroStats } from '../tokens/equipment/hero-stats';
import {
  fixtureGenerator,
  rollFor,
  typeOf,
} from '../tokens/equipment/generator/generator-test-setup';
import { HexMapBuilder } from './builders/hex-map-builder';
import { hexDistance } from '../utils/hex-utils';
import { revealAroundHero } from './fog-service';
import { heroFogRadius } from './hero-fog';

describe('A01 hero sight', () => {
  it.each([
    { bonus: 0, count: 7 },
    { bonus: 1, count: 19 },
    { bonus: 2, count: 37 },
  ])('EA-12: bonus $bonus reveals $count tiles around either row parity', ({ bonus, count }) => {
    for (const rowIndex of [4, 5]) {
      const map = new HexMapBuilder().name('sight').width(11).height(11).build();
      for (const tile of map.tiles) tile.isRevealed = false;
      const at = { columnIndex: 5, rowIndex };
      const radius = bonus ? heroFogRadius(fogInventory(bonus)) : heroFogRadius();
      expect(revealAroundHero(map, at, radius)).toHaveLength(count);
      for (const tile of map.tiles)
        expect(tile.isRevealed).toBe(hexDistance(at, tile.coordinates) <= 1 + bonus);
    }
  });

  it('caps multiple equipped contributions at +2 and ignores the bag', () => {
    const inventory = fogInventory(2);
    inventory.equip.armor = { ...inventory.equip.helm!, id: 'other' };
    expect(resolveHeroStats(Object.values(inventory.equip)).fogRadius).toBe(2);
    expect(heroFogRadius(inventory)).toBe(3);
    expect(heroFogRadius(fogInventory(2, false))).toBe(1);
  });

  it('reveals only existing tiles at an edge or across a void, without hiding explored tiles', () => {
    const map = new HexMapBuilder().name('sparse-sight').width(9).height(9).build();
    for (const tile of map.tiles) tile.isRevealed = false;
    map.tiles = map.tiles.filter((tile) => tile.coordinates.columnIndex !== 1);
    const explored = map.tiles.find((tile) => tile.coordinates.columnIndex === 8)!;
    explored.isRevealed = true;
    const at = { columnIndex: 0, rowIndex: 4 };
    const revealed = revealAroundHero(map, at, 3);
    expect(revealed.every((coordinate) => coordinate.columnIndex !== 1)).toBe(true);
    expect(revealed.some((coordinate) => coordinate.columnIndex === 2)).toBe(true);
    expect(
      map.tiles.every(
        (tile) => tile.isRevealed === (tile === explored || hexDistance(at, tile.coordinates) <= 3),
      ),
    ).toBe(true);
    expect(
      new Set(revealed.map((coordinate) => `${coordinate.columnIndex}:${coordinate.rowIndex}`))
        .size,
    ).toBe(revealed.length);
  });

  it('EA-16: fog is implemented, rolls for helms, and reaches its stat reader', () => {
    expect(EQUIPMENT_ATTRIBUTES.find((attribute) => attribute.key === 'fog')?.implemented).toBe(
      true,
    );
    const generator = fixtureGenerator(EQUIPMENT_ATTRIBUTES);
    let found = false;
    for (let seed = 0; seed < 100; seed++) {
      const attributes = rollFor(generator, typeOf('helm'), 4, seed);
      found ||= attributes.some((attribute) => attribute.key === 'fog');
      expect(
        attributes.every((attribute) => ['heart', 'will', 'fog'].includes(attribute.key)),
      ).toBe(true);
    }
    expect(found).toBe(true);
    const attributes = EQUIPMENT_ATTRIBUTES.map((attribute) =>
      attribute.key === 'fog' ? { ...attribute, deprecated: true } : attribute,
    );
    expect(
      resolveHeroStats(Object.values(fogInventory(1).equip), { attributes, types: EQUIPMENT_TYPES })
        .fogRadius,
    ).toBe(1);
  });
});
