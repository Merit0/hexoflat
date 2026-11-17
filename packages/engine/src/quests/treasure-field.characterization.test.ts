import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../utils/hash/sha256';
import { createTreasureField } from './treasure-field';

describe('saved Treasure Seeker geometry', () => {
  it.each(['same', 'seed-secret', 'quest-seed'])(
    'preserves legacy floor and start for %s',
    (seed) => {
      const { floor, start } = createTreasureField(seed);
      expect(sha256Hex(JSON.stringify({ floor, start }))).toMatchSnapshot();
    },
  );
});

it('pipeline owns real floor, border objects and a replacement door next to the start', () => {
  const field = createTreasureField('quest-seed');
  const floor = field.map.tiles.filter((tile) => tile.regionId === 'field');
  const border = field.map.tiles.filter((tile) => tile.regionId === 'border');
  expect(floor).toHaveLength(field.floor.length);
  expect(floor.every((tile) => tile.hexobject === null)).toBe(true);
  expect(border).toHaveLength(42);
  const doors = border.filter((tile) => tile.hexobject?.hexobjectKey === 'camping-entrance');
  expect(doors).toHaveLength(1);
  expect(doors[0].coordinates).toEqual(field.exit);
  expect(
    field.map.tiles.every(
      (tile) => tile.hexBackgroundImagePath === '/hex-assets/board-hexes/stone-hex.png',
    ),
  ).toBe(true);
  expect(field.descriptor).toMatchObject({ kind: 'RECIPE', recipeId: 'treasure-seeker-map' });
});
