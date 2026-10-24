import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TERRAIN,
  TERRAIN,
  TERRAIN_IDS,
  isTerrainPassable,
  terrainFromSymbol,
  terrainStepCost,
} from './terrain';

describe('TERRAIN registry', () => {
  it('TERRAIN every id has a unique symbol and a step cost of 1 (no gameplay change yet)', () => {
    const symbols = TERRAIN_IDS.map((id) => TERRAIN[id].symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
    for (const id of TERRAIN_IDS) expect(TERRAIN[id].stepCost).toBe(1);
  });

  it('TERRAIN only ground is passable; undefined means ground', () => {
    expect(isTerrainPassable(undefined)).toBe(true);
    expect(isTerrainPassable(DEFAULT_TERRAIN)).toBe(true);
    expect(isTerrainPassable('mountain')).toBe(false);
    expect(isTerrainPassable('water')).toBe(false);
    expect(terrainStepCost(undefined)).toBe(1);
  });

  it('TERRAIN maps drawing symbols back to non-ground terrain', () => {
    expect(terrainFromSymbol('^')).toBe('mountain');
    expect(terrainFromSymbol('=')).toBe('water');
    expect(terrainFromSymbol('.')).toBeNull();
    expect(terrainFromSymbol('#')).toBeNull();
  });
});
