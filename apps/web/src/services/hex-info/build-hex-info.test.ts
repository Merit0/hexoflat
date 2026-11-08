import { describe, expect, it } from 'vitest';
import { heartsFor } from './build-hex-info';

describe('heartsFor', () => {
  it('draws one heart per hp for small creatures', () => {
    expect(heartsFor(3, 5).fills).toEqual([1, 1, 1, 0, 0]);
  });

  it('caps the icons at ten and scales the fill', () => {
    const hearts = heartsFor(30, 100);
    expect(hearts.fills).toHaveLength(10);
    expect(hearts.fills.filter((fill) => fill === 1)).toHaveLength(3);
  });

  it('never shows a living creature with an empty heart row', () => {
    expect(heartsFor(1, 100).fills[0]).toBe(0.5);
    expect(heartsFor(0, 100).fills.every((fill) => fill === 0)).toBe(true);
  });

  it('rounds partial hearts to halves', () => {
    expect(heartsFor(2, 15).fills.slice(0, 2)).toEqual([1, 0.5]);
  });
});
