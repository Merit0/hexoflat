import { describe, expect, it } from 'vitest';
import { axialToOddQ, oddQToAxial } from './hex-utils';

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
