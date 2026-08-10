import { describe, expect, it } from 'vitest';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey, getOddQNeighbors } from '../utils/hex-utils';
import { pickCampfireSpawn, pickEntrySpawn, pickEntrySpawnDeterministic } from './spawn-placement';

const ENTRY_KEY = HEXOBJECT_KEYS.HOMELAND_GATE;
// Walls must use a *different* solid key than the entrance, or the entrance
// lookup would find a wall tile instead of the real entrance.
const WALL_KEY = HEXOBJECT_KEYS.ROCK;

function buildMap(width = 5, height = 5) {
  return new HexMapBuilder().name('spawn-test').width(width).height(height).build();
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

// A stubbed RandomSource: spawn placement must be reproducible from a seed,
// which is the whole reason Math.random was pushed out to the caller.
const alwaysFirst = () => 0;
const alwaysLast = () => 0.999;

describe('pickEntrySpawn', () => {
  it('spawns on a walkable neighbour of the entrance, not on the entrance itself', () => {
    const map = buildMap();
    const entry = { columnIndex: 2, rowIndex: 2 };
    placeAt(map, entry, ENTRY_KEY);

    const spawn = pickEntrySpawn(map, ENTRY_KEY, alwaysFirst);

    expect(coordinateKey(spawn)).not.toBe(coordinateKey(entry));
  });

  it('is reproducible: the same random source gives the same tile', () => {
    const map = buildMap();
    placeAt(map, { columnIndex: 2, rowIndex: 2 }, ENTRY_KEY);

    const first = pickEntrySpawn(map, ENTRY_KEY, alwaysFirst);
    const second = pickEntrySpawn(map, ENTRY_KEY, alwaysFirst);

    expect(first).toEqual(second);
  });

  it('honours the random source: different draws pick different neighbours', () => {
    const map = buildMap();
    placeAt(map, { columnIndex: 2, rowIndex: 2 }, ENTRY_KEY);

    const low = pickEntrySpawn(map, ENTRY_KEY, alwaysFirst);
    const high = pickEntrySpawn(map, ENTRY_KEY, alwaysLast);

    expect(coordinateKey(low)).not.toBe(coordinateKey(high));
  });

  it('never picks a solid neighbour, whatever the random draw says', () => {
    const map = buildMap();
    const entry = { columnIndex: 2, rowIndex: 2 };
    placeAt(map, entry, ENTRY_KEY);

    // Wall in every neighbour but one — that survivor is the only legal
    // answer, so both ends of the random range must land on it.
    const neighbors = getOddQNeighbors(entry);
    const [survivor, ...blocked] = neighbors;
    for (const coord of blocked) placeAt(map, coord, WALL_KEY);

    expect(pickEntrySpawn(map, ENTRY_KEY, alwaysFirst)).toEqual(survivor);
    expect(pickEntrySpawn(map, ENTRY_KEY, alwaysLast)).toEqual(survivor);
  });

  it('falls back to the entrance itself when it is completely walled in', () => {
    const map = buildMap();
    const entry = { columnIndex: 2, rowIndex: 2 };
    placeAt(map, entry, ENTRY_KEY);
    for (const coord of getOddQNeighbors(entry)) {
      placeAt(map, coord, WALL_KEY);
    }

    expect(pickEntrySpawn(map, ENTRY_KEY, alwaysFirst)).toEqual(entry);
  });

  it('falls back to the map origin when the map has no entrance', () => {
    expect(pickEntrySpawn(buildMap(), ENTRY_KEY, alwaysFirst)).toEqual({
      columnIndex: 0,
      rowIndex: 0,
    });
  });
});

describe('pickEntrySpawnDeterministic', () => {
  it('needs no random source and is stable across calls', () => {
    const map = buildMap();
    placeAt(map, { columnIndex: 2, rowIndex: 2 }, ENTRY_KEY);

    expect(pickEntrySpawnDeterministic(map, ENTRY_KEY)).toEqual(
      pickEntrySpawnDeterministic(map, ENTRY_KEY),
    );
  });

  it('falls back to the map origin when the map has no entrance', () => {
    expect(pickEntrySpawnDeterministic(buildMap(), ENTRY_KEY)).toEqual({
      columnIndex: 0,
      rowIndex: 0,
    });
  });
});

describe('pickCampfireSpawn', () => {
  it('spawns beside the fireplace', () => {
    const map = buildMap();
    const campfire = { columnIndex: 2, rowIndex: 2 };
    placeAt(map, campfire, HEXOBJECT_KEYS.FIREPLACE);

    const spawn = pickCampfireSpawn(map)!;

    expect(spawn).not.toBeNull();
    expect(coordinateKey(spawn)).not.toBe(coordinateKey(campfire));
  });

  it('returns null when the map has no fireplace, so the caller can fall back', () => {
    expect(pickCampfireSpawn(buildMap())).toBeNull();
  });
});
