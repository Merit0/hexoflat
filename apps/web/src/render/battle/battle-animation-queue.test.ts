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
  toolKey: 'sword',
  ring: [{ q: 1, r: 0 }],
  durationMs: 400,
};

describe('BattleAnimationQueue', () => {
  it('holds the enemy at its old hex, walks it to the next, then swings the tool round the attacker', () => {
    const queue = new BattleAnimationQueue(geo);
    queue.enqueue([walk, strike]);

    expect(queue.frame().poses.get('s1')).toEqual({ x: 300, y: 0, alpha: 1 });
    const mid = queue.advance(150).poses.get('s1')!;
    expect(mid.x).toBeLessThan(300);
    expect(mid.x).toBeGreaterThan(200);

    const during = queue.advance(150 + 200);
    expect(during.poses.has('s1')).toBe(false);
    expect(during.fx?.toolKey).toBe('sword');
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
  it('starts the tool beside the attacker, on the side of the target, fading in', () => {
    const start = sampleStrikeFx(strike, 0, geo)!;
    expect(start.tool.x).toBeCloseTo(200 - 70);
    expect(start.tool.y).toBeCloseTo(0);
    expect(start.tool.alpha).toBe(0);
    expect(sampleStrikeFx(strike, 0.2, geo)!.tool.alpha).toBe(1);
  });

  it('goes once round the attacker hex, never round the target, and fades out', () => {
    const turned = sampleStrikeFx(strike, 0.5, geo)!;
    expect(turned.tool.x).toBeCloseTo(200 - 70);
    expect(turned.tool.y).toBeCloseTo(0);
    const quarter = sampleStrikeFx(strike, 0.25, geo)!;
    expect(quarter.tool.x).toBeCloseTo(200);
    expect(Math.abs(quarter.tool.y)).toBeCloseTo(70);
    for (const t of [0.1, 0.3, 0.6, 0.9]) {
      const { tool } = sampleStrikeFx(strike, t, geo)!;
      expect(Math.hypot(tool.x - 200, tool.y)).toBeCloseTo(70);
    }
    const end = sampleStrikeFx(strike, 1, geo)!;
    expect(end.tool.x).toBeCloseTo(200 - 70);
    expect(end.tool.alpha).toBe(0);
  });

  it('never shows the tool when the owner is unknown, so it cannot circle anyone else', () => {
    const fx = sampleStrikeFx({ ...strike, from: null }, 0.5, geo)!;
    expect(fx.tool.alpha).toBe(0);
  });
});
