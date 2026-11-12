import { describe, expect, it } from 'vitest';
import { buildStaticBoard } from '../../boards/build-static-board';
import { HEXOBJECT_KEYS } from '../../registry/hexobjects-registry';
import { coordinateKey, getHexNeighbors, hexDistance } from '../../utils/hex-utils';
import { campObjectSpots, standsNextToCampObject } from './camp-object-spot';
import { CAMPING_BOARD } from './static/camping';

const CHEST = HEXOBJECT_KEYS.STASH_CHEST;

function chestOnTheBuiltCamp() {
  const { map } = buildStaticBoard(CAMPING_BOARD);
  const tile = map.tiles.find((candidate) => candidate.hexobject?.hexobjectKey === CHEST);
  if (!tile) throw new Error('the camp drawing has no stash chest');
  return tile.coordinates;
}

const inCamp = (coordinates: { columnIndex: number; rowIndex: number }) => ({
  locationKey: 'camping',
  coordinates,
});

describe('campObjectSpots', () => {
  it('finds the stash chest exactly where the built camp map has it', () => {
    expect(campObjectSpots(CHEST)).toEqual([chestOnTheBuiltCamp()]);
  });

  it('finds nothing for an object the camp drawing does not hold', () => {
    expect(campObjectSpots(HEXOBJECT_KEYS.SWORD)).toEqual([]);
  });
});

describe('standsNextToCampObject', () => {
  const chest = chestOnTheBuiltCamp();

  it('is true on every one of the six hexes around the chest', () => {
    const around = getHexNeighbors(chest);
    expect(around).toHaveLength(6);
    for (const hex of around) expect(standsNextToCampObject(inCamp(hex), CHEST)).toBe(true);
  });

  it('is false two hexes away from the chest', () => {
    const { map } = buildStaticBoard(CAMPING_BOARD);
    const twoAway = map.tiles
      .map((tile) => tile.coordinates)
      .filter((hex) => hexDistance(hex, chest) === 2);
    expect(twoAway.length).toBeGreaterThan(0);
    for (const hex of twoAway) expect(standsNextToCampObject(inCamp(hex), CHEST)).toBe(false);
  });

  it('is false on the chest hex itself', () => {
    expect(standsNextToCampObject(inCamp(chest), CHEST)).toBe(false);
  });

  it('is false next to the same hex in another location', () => {
    const beside = getHexNeighbors(chest)[0];
    expect(standsNextToCampObject({ locationKey: 'silesia', coordinates: beside }, CHEST)).toBe(
      false,
    );
    expect(standsNextToCampObject({ locationKey: 'cave', coordinates: beside }, CHEST)).toBe(false);
  });

  it('is false when the server does not know where the hero is', () => {
    expect(standsNextToCampObject(null, CHEST)).toBe(false);
  });

  it('answers for any drawn camp object, not only the chest', () => {
    const [fire] = campObjectSpots(HEXOBJECT_KEYS.FIREPLACE);
    const beside = getHexNeighbors(fire).find(
      (hex) => coordinateKey(hex) !== coordinateKey(chest),
    )!;
    expect(standsNextToCampObject(inCamp(beside), HEXOBJECT_KEYS.FIREPLACE)).toBe(true);
    expect(standsNextToCampObject(inCamp(beside), HEXOBJECT_KEYS.SWORD)).toBe(false);
  });
});
