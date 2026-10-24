import { describe, expect, it } from 'vitest';
import { SILESIA_BOARD } from '../content/boards/static/silesia';
import { buildStaticBoard } from './build-static-board';
import { BOARD_COLUMNS, BOARD_ROWS } from './board-size';
import { coordinateKey } from '../utils/hex-utils';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';

describe('buildStaticBoard', () => {
  it('frames silesia with impassable mountains: almost the whole 18x17 frame is tiles and the corners are empty', () => {
    const { map } = buildStaticBoard(SILESIA_BOARD);
    const byKey = new Map(map.tiles.map((tile) => [coordinateKey(tile.coordinates), tile]));

    expect(map.width).toBe(BOARD_COLUMNS);
    expect(map.height).toBe(BOARD_ROWS);
    expect(map.tiles.length).toBeGreaterThan(BOARD_COLUMNS * BOARD_ROWS * 0.9);
    expect(map.tiles.length).toBeLessThan(BOARD_COLUMNS * BOARD_ROWS);
    for (const corner of [
      { columnIndex: 0, rowIndex: 0 },
      { columnIndex: BOARD_COLUMNS - 1, rowIndex: 0 },
      { columnIndex: 0, rowIndex: BOARD_ROWS - 1 },
      { columnIndex: BOARD_COLUMNS - 1, rowIndex: BOARD_ROWS - 1 },
    ]) {
      expect(byKey.has(coordinateKey(corner)), 'corner should be empty').toBe(false);
    }
    const openGround = map.tiles.filter((tile) => tile.terrain === 'ground' && !tile.hexobject);
    expect(openGround.length).toBeLessThan(BOARD_COLUMNS * BOARD_ROWS * 0.6);
  });

  it('keeps every object kind of the old silesia and puts a mountain ridge, a lake and the cave in it', () => {
    const { map } = buildStaticBoard(SILESIA_BOARD);
    const kinds = new Set(map.tiles.map((tile) => tile.hexobject?.hexobjectKey));

    for (const key of [
      HEXOBJECT_KEYS.TREE,
      HEXOBJECT_KEYS.ROCK,
      HEXOBJECT_KEYS.HEALTH_BOTTLE,
      HEXOBJECT_KEYS.MANA_BOTTLE,
      HEXOBJECT_KEYS.ENERGY_BOTTLE,
      HEXOBJECT_KEYS.CAMPING_ENTRANCE,
      HEXOBJECT_KEYS.CAVE_ENTRANCE,
    ]) {
      expect(kinds.has(key), key).toBe(true);
    }
    expect(map.tiles.some((tile) => tile.terrain === 'mountain')).toBe(true);
    expect(map.tiles.some((tile) => tile.terrain === 'water')).toBe(true);

    const placedObjectCount = map.tiles.filter((tile) => tile.hexobject).length;
    const configObjectCount = map.config.reduce(
      (sum, placement) => sum + placement.coordinates.length,
      0,
    );
    expect(configObjectCount).toBe(placedObjectCount);
  });

  it('is identical on every call and its drawingHash is stable', () => {
    const first = buildStaticBoard(SILESIA_BOARD);
    const second = buildStaticBoard(SILESIA_BOARD);

    expect(first.descriptor.drawingHash).toBe(second.descriptor.drawingHash);
    expect(first.map.tiles.length).toBe(second.map.tiles.length);
  });

  it('defaults to FOG but honors an explicit fogPolicy', () => {
    expect(buildStaticBoard(SILESIA_BOARD).map.fogPolicy).toBe('FOG');
    expect(buildStaticBoard(SILESIA_BOARD, 'ALL_REVEALED').map.fogPolicy).toBe('ALL_REVEALED');
  });
});
