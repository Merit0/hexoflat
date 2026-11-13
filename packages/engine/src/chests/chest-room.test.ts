import { describe, expect, it } from 'vitest';
import { MapRegistry } from '../registry/world-map-registry';
import { CAVE_MODEL } from '../content/boards/models/cave';
import { runBoardPipeline } from '../boards/pipeline/run-board-pipeline';
import { isTerrainPassable } from '../boards/terrain';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';

const SEEDS = 200;

function chestRooms(seed: string) {
  const built = runBoardPipeline(CAVE_MODEL, { seed });
  const byKey = new Map(built.map.tiles.map((tile) => [coordinateKey(tile.coordinates), tile]));
  const chests = built.map.tiles.filter(
    (tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.CHEST,
  );
  return chests.map((chest) => ({
    free: getHexNeighbors(chest.coordinates).filter((coord) => {
      const tile = byKey.get(coordinateKey(coord));
      return !!tile && isTerrainPassable(tile.terrain) && !tile.hexobject;
    }).length,
  }));
}

describe('the cave chest today (characterization, REQ-LOOT-054)', () => {
  it('has exactly one chest per cave', () => {
    for (let i = 0; i < SEEDS; i += 1) {
      expect(chestRooms(`room-${i}`)).toHaveLength(1);
    }
  });
});

describe('the cave chest after the generator rule (REQ-LOOT-064)', () => {
  it('has at least three passable neighbours without objects on 200 real boards', () => {
    for (let i = 0; i < SEEDS; i += 1) {
      const { map } = MapRegistry.get('cave').create({ seed: `real-${i}` });
      const byKey = new Map(map.tiles.map((tile) => [coordinateKey(tile.coordinates), tile]));
      const chests = map.tiles.filter((t) => t.hexobject?.hexobjectKey === HEXOBJECT_KEYS.CHEST);
      expect(chests).toHaveLength(1);
      const open = getHexNeighbors(chests[0].coordinates).filter((coord) => {
        const tile = byKey.get(coordinateKey(coord));
        return !!tile && isTerrainPassable(tile.terrain) && !tile.hexobject;
      });
      expect(open.length).toBeGreaterThanOrEqual(3);
    }
  });
});
