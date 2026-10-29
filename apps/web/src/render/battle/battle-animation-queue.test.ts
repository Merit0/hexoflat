import { describe, expect, it } from 'vitest';
import type { BattleHex } from '@hexoflat/engine/battle/battle-state';
import type { BattleAnimationStep } from './battle-animation-plan';
import { BattleAnimationQueue } from './battle-animation-queue';
import { sampleStrikeFx, type AnimationGeometry } from './battle-animation-sample';

const geo: AnimationGeometry = {
  centreOf: (hex: BattleHex) => ({ x: hex.q * 100, y: hex.r * 100 }),
  tileHeight: 100,
};

const walk: BattleAnimationStep = {
  kind: 'walk',
  creatureId: 's1',
  from: { q: 3, r: 0 },
  to: { q: 2, r: 0 },
  durationMs: 300,
};
const strike: BattleAnimationStep = {
  kind: 'strike',
  targetId: 'hero',
  target: { q: 0, r: 0 },
  from: { q: 2, r: 0 },
  ring: [{ q: 1, r: 0 }],
  durationMs: 400,
};

describe('BattleAnimationQueue', () => {
  it('holds the enemy at its old hex, walks it to the next, then flies the sword from there', () => {
    const queue = new BattleAnimationQueue(geo);
    queue.enqueue([walk, strike]);

    expect(queue.frame().poses.get('s1')).toEqual({ x: 300, y: 0, alpha: 1 });
    const mid = queue.advance(150).poses.get('s1')!;
    expect(mid.x).toBeLessThan(300);
    expect(mid.x).toBeGreaterThan(200);

    const during = queue.advance(150 + 200);
    expect(during.poses.has('s1')).toBe(false);
    expect(during.fx?.ring).toEqual([{ q: 1, r: 0 }]);
    expect(during.fx?.sword.x).toBeLessThan(200);
    expect(during.busy).toBe(true);

    const done = queue.advance(200);
    expect(done).toEqual({ poses: new Map(), fx: null, busy: false });
    expect(queue.busy).toBe(false);
  });

  it('slides through every hex of the path and shakes back to rest', () => {
    const queue = new BattleAnimationQueue(geo);
    queue.enqueue([
      {
        kind: 'slide',
        creatureId: 'hero',
        path: [
          { q: 0, r: 0 },
          { q: 1, r: 0 },
          { q: 2, r: 0 },
        ],
        durationMs: 500,
      },
      { kind: 'shake', creatureId: 'hero', at: { q: 2, r: 0 }, style: 'fall', durationMs: 300 },
    ]);
    expect(queue.advance(250).poses.get('hero')).toEqual({ x: 100, y: 0, alpha: 1 });
    expect(queue.advance(250).poses.get('hero')).toEqual({ x: 200, y: 0, alpha: 1 });
    const shaking = queue.advance(25).poses.get('hero')!;
    expect(shaking.x).toBe(200);
    expect(shaking.y).toBeGreaterThan(0);
    expect(queue.advance(275).busy).toBe(false);
  });

  it('lifts a saw eject in an arc and lands on the free hex', () => {
    const queue = new BattleAnimationQueue(geo);
    queue.enqueue([
      {
        kind: 'eject',
        creatureId: 'hero',
        from: { q: 1, r: 0 },
        to: { q: 0, r: 0 },
        durationMs: 350,
      },
      { kind: 'shake', creatureId: 'hero', at: { q: 0, r: 0 }, style: 'hit', durationMs: 280 },
    ]);
    const mid = queue.advance(175).poses.get('hero')!;
    expect(mid.y).toBeLessThan(-40);
    expect(queue.advance(175).poses.get('hero')).toEqual({ x: 0, y: 0, alpha: 1 });
  });
});

describe('sampleStrikeFx', () => {
  it('flies the sword from the attacker to the target and fades it out', () => {
    const start = sampleStrikeFx(strike, 0, geo)!;
    expect(start.sword).toMatchObject({ x: 200, y: 0, alpha: 1 });
    expect(start.sword.rotation).toBeCloseTo(Math.PI);
    const hit = sampleStrikeFx(strike, 0.75, geo)!;
    expect(hit.sword.x).toBeCloseTo(0);
    expect(hit.sword.y).toBeCloseTo(0);
    expect(hit.ringAlpha).toBeGreaterThan(0.5);
    expect(sampleStrikeFx(strike, 1, geo)!.sword.alpha).toBe(0);
  });

  it('flies a known-side sword from the striker towards the target', () => {
    const fx = sampleStrikeFx({ ...strike, from: { q: -1, r: 0 } }, 0, geo)!;
    expect(fx.sword).toMatchObject({ x: -100, y: 0 });
    expect(fx.sword.rotation).toBeCloseTo(0);
  });
});
