import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorldLoop } from './world-loop';

describe('WorldLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not tick until the interval elapses', () => {
    const loop = new WorldLoop();
    const onTick = vi.fn();

    loop.start(onTick);

    expect(onTick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('keeps ticking on every interval', () => {
    const loop = new WorldLoop();
    const onTick = vi.fn();

    loop.start(onTick);
    vi.advanceTimersByTime(1000);

    expect(onTick).toHaveBeenCalledTimes(4);
  });

  it('starting an already-running loop does not add a second timer', () => {
    const loop = new WorldLoop();
    const first = vi.fn();
    const second = vi.fn();

    loop.start(first);
    loop.start(second);
    vi.advanceTimersByTime(250);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it('stop() halts further ticks', () => {
    const loop = new WorldLoop();
    const onTick = vi.fn();

    loop.start(onTick);
    vi.advanceTimersByTime(250);
    loop.stop();
    vi.advanceTimersByTime(1000);

    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('stopping a loop that never started is a no-op', () => {
    const loop = new WorldLoop();

    expect(() => loop.stop()).not.toThrow();
    expect(loop.isRunning).toBe(false);
  });

  it('can be restarted after being stopped', () => {
    const loop = new WorldLoop();
    const onTick = vi.fn();

    loop.start(onTick);
    loop.stop();
    loop.start(onTick);
    vi.advanceTimersByTime(250);

    expect(loop.isRunning).toBe(true);
    expect(onTick).toHaveBeenCalledTimes(1);
  });
});
