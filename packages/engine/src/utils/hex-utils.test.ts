import { describe, expect, it } from 'vitest';
import { calcHexPixelPosition, coordinateKey, getHexNeighbors, hexDistance } from './hex-utils';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';

const key = (c: IHexCoordinates) => coordinateKey(c);
const sortKeys = (cs: IHexCoordinates[]) => cs.map(key).sort();

describe('getHexNeighbors', () => {
  it('returns the six surrounding cells of an even row', () => {
    expect(sortKeys(getHexNeighbors({ columnIndex: 2, rowIndex: 2 }))).toEqual(
      sortKeys([
        { columnIndex: 3, rowIndex: 2 },
        { columnIndex: 2, rowIndex: 1 },
        { columnIndex: 1, rowIndex: 1 },
        { columnIndex: 1, rowIndex: 2 },
        { columnIndex: 1, rowIndex: 3 },
        { columnIndex: 2, rowIndex: 3 },
      ]),
    );
  });

  it('returns the six surrounding cells of the origin', () => {
    expect(sortKeys(getHexNeighbors({ columnIndex: 0, rowIndex: 0 }))).toEqual(
      sortKeys([
        { columnIndex: 1, rowIndex: 0 },
        { columnIndex: 0, rowIndex: -1 },
        { columnIndex: -1, rowIndex: -1 },
        { columnIndex: -1, rowIndex: 0 },
        { columnIndex: -1, rowIndex: 1 },
        { columnIndex: 0, rowIndex: 1 },
      ]),
    );
  });

  it('is symmetric: every neighbor has the center as one of its own neighbors', () => {
    const center = { columnIndex: 4, rowIndex: 5 };
    for (const n of getHexNeighbors(center)) {
      expect(getHexNeighbors(n).map(key)).toContain(key(center));
    }
  });

  it('places every neighbor at hex distance 1', () => {
    const center = { columnIndex: 3, rowIndex: 4 };
    for (const n of getHexNeighbors(center)) {
      expect(hexDistance(center, n)).toBe(1);
    }
  });
});

describe('hexDistance', () => {
  it('is zero to itself', () => {
    expect(hexDistance({ columnIndex: 2, rowIndex: 2 }, { columnIndex: 2, rowIndex: 2 })).toBe(0);
  });

  it('is symmetric', () => {
    const a = { columnIndex: 1, rowIndex: 5 };
    const b = { columnIndex: 4, rowIndex: 2 };
    expect(hexDistance(a, b)).toBe(hexDistance(b, a));
  });

  it('matches hand-computed distances on the pointy-top offset grid', () => {
    expect(hexDistance({ columnIndex: 0, rowIndex: 0 }, { columnIndex: 2, rowIndex: 2 })).toBe(3);
    expect(hexDistance({ columnIndex: 0, rowIndex: 0 }, { columnIndex: 2, rowIndex: 1 })).toBe(3);
    expect(hexDistance({ columnIndex: 0, rowIndex: 0 }, { columnIndex: 4, rowIndex: 0 })).toBe(4);
    expect(hexDistance({ columnIndex: 0, rowIndex: 0 }, { columnIndex: 0, rowIndex: 4 })).toBe(4);
  });
});

describe('calcHexPixelPosition', () => {
  it('anchors the origin tile at (0, 0)', () => {
    expect(
      calcHexPixelPosition({ coordinates: { columnIndex: 0, rowIndex: 0 } }, 100, 100),
    ).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('projects offset coordinates onto the pointy-top pixel grid', () => {
    expect(
      calcHexPixelPosition({ coordinates: { columnIndex: 2, rowIndex: 2 } }, 100, 100),
    ).toEqual({
      x: 200,
      y: 150,
    });
    expect(
      calcHexPixelPosition({ coordinates: { columnIndex: 1, rowIndex: 1 } }, 100, 100),
    ).toEqual({
      x: 150,
      y: 75,
    });
  });

  it('offsets odd rows by half a column-step', () => {
    const even = calcHexPixelPosition({ coordinates: { columnIndex: 3, rowIndex: 2 } }, 100, 100);
    const odd = calcHexPixelPosition({ coordinates: { columnIndex: 3, rowIndex: 3 } }, 100, 100);
    expect(odd.x - even.x).toBe(50);
  });

  it('keeps vertically stacked rows exactly three-quarters of a box apart', () => {
    const a = calcHexPixelPosition({ coordinates: { columnIndex: 2, rowIndex: 2 } }, 120, 100);
    const b = calcHexPixelPosition({ coordinates: { columnIndex: 2, rowIndex: 4 } }, 120, 100);
    expect(b.y - a.y).toBe(100 * 0.75 * 2);
  });
});
