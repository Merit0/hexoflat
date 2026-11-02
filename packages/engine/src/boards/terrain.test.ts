import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TERRAIN,
  TERRAIN,
  TERRAIN_IDS,
  isTerrainPassable,
  terrainFromSymbol,
} from './terrain';

describe('TERRAIN registry', () => {
  it('TERRAIN every drawable id has a unique symbol', () => {
    const symbols = TERRAIN_IDS.map((id) => TERRAIN[id].symbol).filter((s) => s !== null);
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it('TERRAIN battle reliefs cannot be drawn and stay passable', () => {
    for (const id of ['rubble', 'ledge', 'oil', 'saw'] as const) {
      expect(TERRAIN[id].symbol).toBeNull();
      expect(isTerrainPassable(id)).toBe(true);
    }
  });

  it('TERRAIN only ground is passable; undefined means ground', () => {
    expect(isTerrainPassable(undefined)).toBe(true);
    expect(isTerrainPassable(DEFAULT_TERRAIN)).toBe(true);
    expect(isTerrainPassable('mountain')).toBe(false);
    expect(isTerrainPassable('water')).toBe(false);
  });

  it('TERRAIN maps drawing symbols back to non-ground terrain', () => {
    expect(terrainFromSymbol('^')).toBe('mountain');
    expect(terrainFromSymbol('=')).toBe('water');
    expect(terrainFromSymbol('.')).toBeNull();
    expect(terrainFromSymbol('#')).toBeNull();
  });
});
