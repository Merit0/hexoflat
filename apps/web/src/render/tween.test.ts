import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Ticker } from 'pixi.js';
import { easeOutCubic, runTween } from './tween';

let now = 0;

describe('runTween', () => {
  beforeEach(() => {
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });
  afterEach(() => vi.restoreAllMocks());

  it('reports progress, resolves at the end and removes its ticker listener', async () => {
    const before = Ticker.shared.count;
    const seen: number[] = [];
    const tween = runTween(100, (p) => seen.push(p));
    expect(Ticker.shared.count).toBe(before + 1);

    now = 50;
    Ticker.shared.update(now);
    now = 120;
    Ticker.shared.update(now);
    await tween.done;

    expect(seen).toEqual([0.5, 1]);
    expect(Ticker.shared.count).toBe(before);
  });

  it('cancel resolves immediately and stops further frames', async () => {
    const seen: number[] = [];
    const tween = runTween(100, (p) => seen.push(p));

    tween.cancel();
    now = 60;
    Ticker.shared.update(now);
    await tween.done;

    expect(seen).toEqual([]);
  });

  it('eases out from 0 to 1', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});
