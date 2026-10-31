import { describe, expect, it } from 'vitest';
import type HexMapModel from './models/hex-map-model';
import { initFog, revealAroundHero } from './fog-service';
import { runBoardPipeline } from '../boards/pipeline/run-board-pipeline';
import { CAVE_MODEL } from '../content/boards/models/cave';
import { SILESIA_RECIPE } from '../content/boards/recipes/silesia';
import { SILESIA_NORTH_RECIPE } from '../content/boards/recipes/silesia-north';
import { CAMPING_RECIPE } from '../content/boards/recipes/camping';
import { isTerrainAlwaysVisible } from '../boards/terrain';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';

function revealedKeys(map: HexMapModel): Set<string> {
  return new Set(
    map.tiles.filter((tile) => tile.isRevealed).map((tile) => coordinateKey(tile.coordinates)),
  );
}

describe('one fog rule for every board', () => {
  it('uses plain FOG on the world and the cave, and shows only the camp in full', () => {
    expect(CAVE_MODEL.fog).toBe('FOG');
    expect(SILESIA_RECIPE.fog).toBe('FOG');
    expect(SILESIA_NORTH_RECIPE.fog).toBe('FOG');
    expect(CAMPING_RECIPE.fog).toBe('ALL_REVEALED');
  });

  it('opens only the hero hex and its six neighbours in every generated cave', () => {
    for (let i = 0; i < 40; i += 1) {
      const { map } = runBoardPipeline(CAVE_MODEL, { seed: `fog-${i}` });
      initFog(map);
      const before = revealedKeys(map);
      const floor = map.tiles.find(
        (tile) =>
          !isTerrainAlwaysVisible(tile.terrain) && !before.has(coordinateKey(tile.coordinates)),
      )!;

      revealAroundHero(map, floor.coordinates);

      const allowed = new Set([
        ...before,
        coordinateKey(floor.coordinates),
        ...getHexNeighbors(floor.coordinates).map(coordinateKey),
      ]);
      for (const key of revealedKeys(map)) expect(allowed.has(key), `seed ${i}`).toBe(true);
    }
  });
});
