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

  it('runs two tweens side by side and finishes both', async () => {
    const before = Ticker.shared.count;
    const short = runTween(50, () => {});
    const long = runTween(100, () => {});

    now = 60;
    Ticker.shared.update(now);
    await short.done;
    expect(Ticker.shared.count).toBe(before + 1);
    now = 110;
    Ticker.shared.update(now);
    await long.done;

    expect(Ticker.shared.count).toBe(before);
  });

  it('REQ-3: a throwing frame removes its listener, settles, logs once and spares other tweens', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const before = Ticker.shared.count;
    const broken = runTween(100, () => {
      throw new TypeError('destroyed');
    });
    const seen: number[] = [];
    const healthy = runTween(100, (p) => seen.push(p));

    now = 30;
    expect(() => Ticker.shared.update(now)).not.toThrow();
    await broken.done;
    now = 60;
    Ticker.shared.update(now);
    now = 120;
    Ticker.shared.update(now);
    await healthy.done;

    expect(seen).toEqual([0.3, 0.6, 1]);
    expect(log).toHaveBeenCalledTimes(1);
    expect(Ticker.shared.count).toBe(before);
  });

  it('eases out from 0 to 1', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});
