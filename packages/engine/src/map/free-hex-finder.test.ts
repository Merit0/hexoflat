import { describe, expect, it } from 'vitest';
import { HexMapBuilder } from './builders/hex-map-builder';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey, getOddQNeighbors } from '../utils/hex-utils';
import { findFreeHexNear, findFreeHexNearObject } from './free-hex-finder';

const LANDMARK = HEXOBJECT_KEYS.HOMELAND_GATE;
// Walls must differ from the landmark key, or the landmark lookup would find
// a wall instead of the landmark.
const WALL = HEXOBJECT_KEYS.ROCK;

const alwaysFirst = () => 0;
const alwaysLast = () => 0.999;

function buildMap(width = 5, height = 5) {
  return new HexMapBuilder().name('free-hex').width(width).height(height).build();
}

function placeAt(
  map: ReturnType<typeof buildMap>,
  coord: { columnIndex: number; rowIndex: number },
  key: string,
) {
  const tile = map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(coord))!;
  tile.hexobject = HexObjectFactory.create(key as never, coord);
  return tile;
}

describe('findFreeHexNear', () => {
  const centre = { columnIndex: 2, rowIndex: 2 };

  it('returns a neighbour, never the tile itself', () => {
    const found = findFreeHexNear(buildMap(), centre)!;

    expect(coordinateKey(found)).not.toBe(coordinateKey(centre));
    expect(getOddQNeighbors(centre).map(coordinateKey)).toContain(coordinateKey(found));
  });

  it('is stable across calls when no generator is passed', () => {
    const map = buildMap();

    expect(findFreeHexNear(map, centre)).toEqual(findFreeHexNear(map, centre));
  });

  it('honours the generator when one is passed', () => {
    const map = buildMap();

    expect(findFreeHexNear(map, centre, alwaysFirst)).not.toEqual(
      findFreeHexNear(map, centre, alwaysLast),
    );
  });

  it('skips solid neighbours whatever the generator draws', () => {
    const map = buildMap();
    const [survivor, ...blocked] = getOddQNeighbors(centre);
    for (const coord of blocked) placeAt(map, coord, WALL);

    expect(findFreeHexNear(map, centre, alwaysFirst)).toEqual(survivor);
    expect(findFreeHexNear(map, centre, alwaysLast)).toEqual(survivor);
  });

  it('returns null when every neighbour is solid', () => {
    const map = buildMap();
    for (const coord of getOddQNeighbors(centre)) placeAt(map, coord, WALL);

    expect(findFreeHexNear(map, centre)).toBeNull();
  });

  it('ignores neighbours that fall off the map', () => {
    const map = buildMap();

    const found = findFreeHexNear(map, { columnIndex: 0, rowIndex: 0 })!;

    expect(map.tiles.some((t) => coordinateKey(t.coordinates) === coordinateKey(found))).toBe(true);
  });

  it('returns null for a coordinate that is not on the map', () => {
    expect(findFreeHexNear(buildMap(), { columnIndex: 99, rowIndex: 99 })).toBeNull();
  });
});

describe('findFreeHexNearObject', () => {
  it('finds a hex beside the landmark', () => {
    const map = buildMap();
    const landmark = { columnIndex: 2, rowIndex: 2 };
    placeAt(map, landmark, LANDMARK);

    const found = findFreeHexNearObject(map, LANDMARK)!;

    expect(getOddQNeighbors(landmark).map(coordinateKey)).toContain(coordinateKey(found));
  });

  it('falls back to the landmark tile when it is walled in', () => {
    const map = buildMap();
    const landmark = { columnIndex: 2, rowIndex: 2 };
    placeAt(map, landmark, LANDMARK);
    for (const coord of getOddQNeighbors(landmark)) placeAt(map, coord, WALL);

    expect(findFreeHexNearObject(map, LANDMARK)).toEqual(landmark);
  });

  it('returns null when the map has no such landmark', () => {
    expect(findFreeHexNearObject(buildMap(), LANDMARK)).toBeNull();
  });

  it('distinguishes two different landmarks on the same map', () => {
    const map = buildMap(7, 7);
    placeAt(map, { columnIndex: 1, rowIndex: 1 }, LANDMARK);
    placeAt(map, { columnIndex: 5, rowIndex: 5 }, HEXOBJECT_KEYS.FIREPLACE);

    const nearGate = findFreeHexNearObject(map, LANDMARK)!;
    const nearFire = findFreeHexNearObject(map, HEXOBJECT_KEYS.FIREPLACE)!;

    expect(coordinateKey(nearGate)).not.toBe(coordinateKey(nearFire));
  });
});
