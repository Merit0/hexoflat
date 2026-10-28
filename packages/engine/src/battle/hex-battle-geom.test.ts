import { describe, expect, it } from 'vitest';
import {
  archerArc,
  battleDistance,
  directionIndex,
  hexInDirection,
  hexKey,
  hexNeighbours,
  parseHexKey,
} from './hex-battle-geom';
import { axialToOffset, offsetToAxial } from '../utils/hex-utils';

describe('battle hex geometry', () => {
  it('lists six neighbours, each one step away', () => {
    const around = hexNeighbours({ q: 0, r: 0 });
    expect(around).toHaveLength(6);
    expect(around.every((h) => battleDistance(h, { q: 0, r: 0 }) === 1)).toBe(true);
  });

  it('measures axial distance', () => {
    expect(battleDistance({ q: 0, r: 0 }, { q: 2, r: -1 })).toBe(2);
    expect(battleDistance({ q: -3, r: 1 }, { q: 2, r: -1 })).toBe(5);
  });

  it('round-trips hex keys', () => {
    expect(parseHexKey(hexKey({ q: -2, r: 3 }))).toEqual({ q: -2, r: 3 });
  });

  it('finds the direction to a neighbour and walks back along it', () => {
    const index = directionIndex({ q: 0, r: 0 }, { q: 0, r: -1 });
    expect(hexInDirection({ q: 0, r: 0 }, index)).toEqual({ q: 0, r: -1 });
    expect(directionIndex({ q: 0, r: 0 }, { q: 2, r: 0 })).toBe(-1);
  });

  it('agrees with the odd-r offset grid used by the map', () => {
    const axial = { q: -1, r: 3 };
    expect(offsetToAxial(axialToOffset(axial))).toEqual(axial);
  });

  it('gives the archer arc as the side facing the archer plus its two neighbours', () => {
    const arc = archerArc({ q: 0, r: 0 }, { q: 3, r: 0 });
    expect(arc).toHaveLength(3);
    expect(arc).toContainEqual({ q: 1, r: 0 });
    expect(arc.every((h) => battleDistance(h, { q: 0, r: 0 }) === 1)).toBe(true);
    expect(arc.every((h) => battleDistance(h, { q: 1, r: 0 }) <= 1)).toBe(true);
  });
});
