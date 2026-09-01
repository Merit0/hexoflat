import { describe, expect, it } from 'vitest';
import {
  AXIAL_DIRS,
  axialNeighbor,
  axialToOddQ,
  oddQToAxial,
  oppositeDir,
  rotateAxial,
  rotateDir,
  type Axial,
} from './hex-utils';

describe('oddQToAxial / axialToOddQ round-trip', () => {
  const coords = [
    { columnIndex: 0, rowIndex: 0 },
    { columnIndex: 1, rowIndex: 0 },
    { columnIndex: 2, rowIndex: 3 },
    { columnIndex: -1, rowIndex: -1 },
    { columnIndex: -3, rowIndex: 2 },
    { columnIndex: 4, rowIndex: -5 },
    { columnIndex: -7, rowIndex: -8 },
  ];

  it('axialToOddQ inverts oddQToAxial for positive and negative coordinates', () => {
    for (const coord of coords) {
      expect(axialToOddQ(oddQToAxial(coord))).toEqual(coord);
    }
  });

  it('oddQToAxial inverts axialToOddQ for positive and negative axial coordinates', () => {
    const axials = [
      { q: 0, r: 0 },
      { q: 1, r: -1 },
      { q: -2, r: 3 },
      { q: -4, r: -4 },
      { q: 5, r: -2 },
    ];

    for (const axial of axials) {
      expect(oddQToAxial(axialToOddQ(axial))).toEqual(axial);
    }
  });
});

describe('axial direction algebra', () => {
  const samples: Axial[] = [
    { q: 0, r: 0 },
    { q: 3, r: -1 },
    { q: -2, r: 4 },
    { q: -5, r: -3 },
  ];

  it('rotateAxial by 6 steps is the identity', () => {
    for (const a of samples) {
      expect(rotateAxial(a, 6)).toEqual(a);
      expect(rotateAxial(a, -6)).toEqual(a);
    }
  });

  it('rotateAxial composes: one step six times returns to start', () => {
    for (const a of samples) {
      let cur = a;
      for (let i = 0; i < 6; i += 1) cur = rotateAxial(cur, 1);
      expect(cur).toEqual(a);
    }
  });

  it('rotateDir agrees with rotating the direction vector', () => {
    for (let dir = 0; dir < 6; dir += 1) {
      for (let steps = 0; steps < 6; steps += 1) {
        const viaVector = rotateAxial(AXIAL_DIRS[dir], steps);
        const viaDir = AXIAL_DIRS[rotateDir(dir, steps)];
        expect({ q: viaDir.q, r: viaDir.r }).toEqual(viaVector);
      }
    }
  });

  it('oppositeDir is an involution and points back', () => {
    for (let dir = 0; dir < 6; dir += 1) {
      expect(oppositeDir(oppositeDir(dir))).toBe(dir);
      const there = axialNeighbor({ q: 2, r: -3 }, dir);
      expect(axialNeighbor(there, oppositeDir(dir))).toEqual({ q: 2, r: -3 });
    }
  });
});
