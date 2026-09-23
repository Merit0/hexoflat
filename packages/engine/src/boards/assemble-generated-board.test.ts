import { describe, expect, it } from 'vitest';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { CAVE_PRESET } from '../content/boards/presets/cave';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { assembleGeneratedBoard } from './assemble-generated-board';
import { BOARD_COLUMNS, BOARD_ROWS } from './board-size';

function hasEnclosedPocket(placedKeys: Set<string>): boolean {
  const outside = new Set<string>();
  const queue: IHexCoordinates[] = [];

  for (let col = 0; col < BOARD_COLUMNS; col += 1) {
    for (const row of [0, BOARD_ROWS - 1]) {
      const coord = { columnIndex: col, rowIndex: row };
      if (!placedKeys.has(coordinateKey(coord))) queue.push(coord);
    }
  }
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (const col of [0, BOARD_COLUMNS - 1]) {
      const coord = { columnIndex: col, rowIndex: row };
      if (!placedKeys.has(coordinateKey(coord))) queue.push(coord);
    }
  }

  while (queue.length) {
    const current = queue.shift() as IHexCoordinates;
    const key = coordinateKey(current);
    if (outside.has(key)) continue;
    outside.add(key);
    for (const neighbor of getHexNeighbors(current)) {
      if (neighbor.columnIndex < 0 || neighbor.columnIndex >= BOARD_COLUMNS) continue;
      if (neighbor.rowIndex < 0 || neighbor.rowIndex >= BOARD_ROWS) continue;
      const neighborKey = coordinateKey(neighbor);
      if (placedKeys.has(neighborKey) || outside.has(neighborKey)) continue;
      queue.push(neighbor);
    }
  }

  let totalEmpty = 0;
  for (let col = 0; col < BOARD_COLUMNS; col += 1) {
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      if (!placedKeys.has(coordinateKey({ columnIndex: col, rowIndex: row }))) totalEmpty += 1;
    }
  }
  return outside.size < totalEmpty;
}

describe('assembleGeneratedBoard', () => {
  it('assembles a valid, reachable board for 200 different seeds', () => {
    for (let i = 0; i < 200; i += 1) {
      const { map } = assembleGeneratedBoard(`cave-seed-${i}`, CAVE_PRESET);

      expect(map.width).toBe(BOARD_COLUMNS);
      expect(map.height).toBe(BOARD_ROWS);

      const keys = map.tiles.map((tile) => coordinateKey(tile.coordinates));
      expect(new Set(keys).size).toBe(keys.length);

      for (const tile of map.tiles) {
        expect(tile.coordinates.columnIndex).toBeGreaterThanOrEqual(0);
        expect(tile.coordinates.columnIndex).toBeLessThan(BOARD_COLUMNS);
        expect(tile.coordinates.rowIndex).toBeGreaterThanOrEqual(0);
        expect(tile.coordinates.rowIndex).toBeLessThan(BOARD_ROWS);
      }

      expect(hasEnclosedPocket(new Set(keys))).toBe(false);

      const exitCount = map.tiles.filter(
        (tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.CAVE_EXIT,
      ).length;
      expect(exitCount).toBe(1);

      const placedObjectCount = map.tiles.filter((tile) => tile.hexobject).length;
      const configObjectCount = map.config.reduce(
        (sum, placement) => sum + placement.coordinates.length,
        0,
      );
      expect(configObjectCount).toBe(placedObjectCount);
    }
  });

  it('gives the same board for the same seed and different boards for different seeds', () => {
    const a1 = assembleGeneratedBoard('same-seed', CAVE_PRESET);
    const a2 = assembleGeneratedBoard('same-seed', CAVE_PRESET);
    const b = assembleGeneratedBoard('different-seed', CAVE_PRESET);

    expect(a1.descriptor).toEqual(a2.descriptor);
    expect(a1.map.tiles.length).toBe(a2.map.tiles.length);

    const aKeys = a1.map.tiles.map((t) => coordinateKey(t.coordinates)).sort();
    const bKeys = b.map.tiles.map((t) => coordinateKey(t.coordinates)).sort();
    expect(aKeys).not.toEqual(bKeys);
  });

  it('falls back to the preset fallbackChunks when no random chunk pool matches', () => {
    const impossiblePreset = {
      ...CAVE_PRESET,
      biome: 'NONEXISTENT',
    } as unknown as typeof CAVE_PRESET;

    const { descriptor, map } = assembleGeneratedBoard('force-fallback', impossiblePreset);
    const fallbackChunks = CAVE_PRESET.fallbackChunks as Record<string, Record<string, string>>;

    expect(descriptor.attempt).toBe(12);
    expect(descriptor.chunkByZone).toEqual(fallbackChunks[descriptor.layoutId]);
    expect(map.tiles.length).toBeGreaterThan(0);
  });
});
