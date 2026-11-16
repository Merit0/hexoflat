import { afterEach, describe, expect, it, vi } from 'vitest';
import { Ticker } from 'pixi.js';
import { subscribeTicker } from './ticker-subscription';

function manualTicker(): Ticker {
  const ticker = new Ticker();
  ticker.autoStart = false;
  ticker.stop();
  return ticker;
}

describe('subscribeTicker', () => {
  afterEach(() => vi.restoreAllMocks());

  it('passes the ticker to the callback every frame until unsubscribed', () => {
    const ticker = manualTicker();
    const seen: Ticker[] = [];
    const unsubscribe = subscribeTicker(ticker, (t) => seen.push(t), { source: 'test' });

    ticker.update(16);
    ticker.update(32);
    unsubscribe();
    ticker.update(48);

    expect(seen).toEqual([ticker, ticker]);
    expect(ticker.count).toBe(0);
    ticker.destroy();
  });

  it('a throwing callback is removed, logged once with its source and spares the others', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ticker = manualTicker();
    const onFailure = vi.fn();
    subscribeTicker(
      ticker,
      () => {
        throw new TypeError('destroyed');
      },
      { source: 'broken-layer', onFailure },
    );
    let healthyFrames = 0;
    subscribeTicker(ticker, () => healthyFrames++, { source: 'healthy' });

    expect(() => ticker.update(16)).not.toThrow();
    ticker.update(32);

    expect(healthyFrames).toBe(2);
    expect(ticker.count).toBe(1);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain('broken-layer');
    ticker.destroy();
  });

  it('REQ-2: unsubscribing again after removal leaves the listener count unchanged', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const ticker = manualTicker();
    const keep = subscribeTicker(ticker, () => {}, { source: 'keep' });
    const removed = subscribeTicker(ticker, () => {}, { source: 'removed' });
    const failed = subscribeTicker(
      ticker,
      () => {
        throw new Error('boom');
      },
      { source: 'failed' },
    );
    ticker.update(16);
    removed();
    expect(ticker.count).toBe(1);

    removed();
    failed();

    expect(ticker.count).toBe(1);
    keep();
    expect(ticker.count).toBe(0);
    ticker.destroy();
  });

  it('a once subscription runs a single time, even when it throws', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ticker = manualTicker();
    let calls = 0;
    const unsubscribe = subscribeTicker(
      ticker,
      () => {
        calls++;
        throw new Error('boom');
      },
      { source: 'first frame', once: true },
    );
    let healthyFrames = 0;
    subscribeTicker(ticker, () => healthyFrames++, { source: 'healthy' });

    expect(() => ticker.update(16)).not.toThrow();
    ticker.update(32);
    unsubscribe();

    expect(calls).toBe(1);
    expect(healthyFrames).toBe(2);
    expect(log).toHaveBeenCalledTimes(1);
    expect(ticker.count).toBe(1);
    ticker.destroy();
  });
});
