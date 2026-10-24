import { describe, expect, it } from 'vitest';
import HexMapModel, { type ISerializedHexMap } from './models/hex-map-model';
import { initFog, revealAroundHero } from './fog-service';
import { runBoardPipeline } from '../boards/pipeline/run-board-pipeline';
import { CAVE_MODEL } from '../content/boards/models/cave';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';

const SEEDS = 100;

function caveBoard(seed: string) {
  const { map, regions } = runBoardPipeline(CAVE_MODEL, { seed });
  initFog(map);
  return { map, regions };
}

function revealed(map: HexMapModel): Set<string> {
  return new Set(
    map.tiles.filter((tile) => tile.isRevealed).map((tile) => coordinateKey(tile.coordinates)),
  );
}

describe('fog by region (the cave)', () => {
  it('the cave recipe uses BY_REGION fog and its tiles carry region ids', () => {
    const { map, regions } = caveBoard('region-ids');

    expect(map.fogPolicy).toBe('BY_REGION');
    for (const region of regions) {
      for (const cell of region.cells) {
        const tile = map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(cell));
        expect(tile?.regionId, region.id).toBe(region.id);
      }
    }
  });

  it('standing in a room reveals the whole room and its walls, not the other rooms', () => {
    for (let i = 0; i < SEEDS; i += 1) {
      const { map, regions } = caveBoard(`room-${i}`);
      const home = regions.find((region) => region.role === 'entry')!;
      const hero = home.cells[Math.floor(home.cells.length / 2)];

      revealAroundHero(map, hero);
      const seen = revealed(map);

      for (const cell of home.cells) expect(seen.has(coordinateKey(cell))).toBe(true);
      for (const cell of home.cells) {
        for (const neighbor of getHexNeighbors(cell)) {
          const exists = map.tiles.some(
            (t) => coordinateKey(t.coordinates) === coordinateKey(neighbor),
          );
          if (exists) expect(seen.has(coordinateKey(neighbor))).toBe(true);
        }
      }

      const deep = regions.find((region) => region.role === 'deep')!;
      const deepCenterSeen = deep.cells.filter((cell) => seen.has(coordinateKey(cell)));
      expect(deepCenterSeen.length).toBeLessThan(deep.cells.length);
    }
  });

  it('a hero in a neck between rooms sees only its neighbours, as on ordinary maps', () => {
    for (let i = 0; i < SEEDS; i += 1) {
      const { map } = caveBoard(`neck-${i}`);
      const neck = map.tiles.find((tile) => !tile.regionId && !tile.hexobject);
      expect(neck).toBeDefined();

      revealAroundHero(map, neck!.coordinates);

      expect(revealed(map).size).toBeLessThanOrEqual(7);
    }
  });

  it('on a FOG map (the world) region ids do nothing: only the hero tile and neighbours open', () => {
    const { map, regions } = caveBoard('plain-fog');
    map.fogPolicy = 'FOG';
    initFog(map);
    const hero = regions[0].cells[0];

    revealAroundHero(map, hero);

    expect(revealed(map).size).toBeLessThanOrEqual(7);
  });

  it('region ids and the fog policy survive a save', () => {
    const { map } = caveBoard('save');
    const json = JSON.parse(JSON.stringify(map.toJSON())) as ISerializedHexMap;
    const restored = HexMapModel.fromJSON(json, 0);

    expect(restored.fogPolicy).toBe('BY_REGION');
    expect(restored.tiles.filter((t) => t.regionId).length).toBe(
      map.tiles.filter((t) => t.regionId).length,
    );
  });

  it('an old save without a fog policy loads as plain FOG', () => {
    const { map } = caveBoard('legacy');
    const json = JSON.parse(JSON.stringify(map.toJSON())) as ISerializedHexMap;
    delete json.fogPolicy;

    expect(HexMapModel.fromJSON(json, 0).fogPolicy).toBe('FOG');
  });

  it('objects placed inside a room keep its region id', () => {
    let withObjects = 0;
    for (let i = 0; i < 30; i += 1) {
      const { map, regions } = caveBoard(`objects-${i}`);
      const regionOf = new Map(
        regions.flatMap((region) => region.cells.map((cell) => [coordinateKey(cell), region.id])),
      );
      for (const tile of map.tiles) {
        const expected = regionOf.get(coordinateKey(tile.coordinates));
        if (!expected) continue;
        expect(tile.regionId).toBe(expected);
        if (tile.hexobject) withObjects += 1;
      }
    }
    expect(withObjects).toBeGreaterThan(0);
  });
});
