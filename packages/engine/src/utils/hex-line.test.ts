import { describe, expect, it } from 'vitest';
import { hexLineAxial } from './hex-line';

function cubeDistance(a: { q: number; r: number }, b: { q: number; r: number }): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -a.q - a.r - (-b.q - b.r);
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

describe('hexLineAxial', () => {
  it('returns a single point when a equals b', () => {
    expect(hexLineAxial({ q: 2, r: -1 }, { q: 2, r: -1 })).toEqual([{ q: 2, r: -1 }]);
  });

  it('returns exactly distance+1 points, starting and ending at the endpoints', () => {
    const a = { q: 0, r: 0 };
    const b = { q: 3, r: -2 };
    const line = hexLineAxial(a, b);

    expect(line).toHaveLength(cubeDistance(a, b) + 1);
    expect(line[0]).toEqual(a);
    expect(line[line.length - 1]).toEqual(b);
  });

  it('every consecutive pair in the line is hex-adjacent (distance 1)', () => {
    const line = hexLineAxial({ q: -2, r: 3 }, { q: 4, r: -1 });
    for (let i = 1; i < line.length; i += 1) {
      expect(cubeDistance(line[i - 1], line[i])).toBe(1);
    }
  });

  it('is symmetric: a->b reversed equals b->a', () => {
    const a = { q: 1, r: 2 };
    const b = { q: -3, r: 1 };
    const forward = hexLineAxial(a, b);
    const backward = hexLineAxial(b, a).slice().reverse();
    expect(forward).toEqual(backward);
  });
});
