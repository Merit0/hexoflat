import { describe, expect, it } from 'vitest';
import type { BattleHex } from '@hexoflat/engine/battle/battle-state';
import { woundDrops } from './battle-wound-drops';

const centreOf = (hex: BattleHex) => ({ x: hex.q * 100, y: hex.r * 100 });
const east = { q: 1, r: 0 };
const west = { q: -1, r: 0 };

describe('woundDrops', () => {
  it('puts one drop in the hex the enemy stood on when it hit', () => {
    expect(woundDrops([east], centreOf, 100)).toEqual([{ x: 100, y: 0 }]);
  });

  it('puts two drops side by side in that hex when it hit twice from there', () => {
    const drops = woundDrops([east, east], centreOf, 100);
    expect(drops).toHaveLength(2);
    expect(drops[0].y).toBe(drops[1].y);
    expect(drops[0].x).toBeLessThan(100);
    expect(drops[1].x).toBeGreaterThan(100);
  });

  it('puts drops in every hex that was hit from, one hex apart', () => {
    const drops = woundDrops([east, west], centreOf, 100);
    expect(drops).toEqual([
      { x: 100, y: 0 },
      { x: -100, y: 0 },
    ]);
  });

  it('shows nothing when nobody was hit', () => {
    expect(woundDrops([], centreOf, 100)).toEqual([]);
  });
});
