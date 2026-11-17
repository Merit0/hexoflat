import { describe, expect, it, vi } from 'vitest';
import {
  holdPortalFxFor,
  playPortalEnter,
  playPortalExit,
  portalFxBusy,
  registerPortalFx,
  releasePortalFx,
} from './portal-fx';

const HEX = { columnIndex: 1, rowIndex: 1 };

describe('portal-fx', () => {
  it('resolves at once when no board is registered', async () => {
    await expect(playPortalEnter(HEX)).resolves.toBeUndefined();
    await expect(playPortalExit(HEX)).resolves.toBeUndefined();
    expect(portalFxBusy.value).toBe(false);
  });

  it('is busy while a registered animation plays, then free', async () => {
    let finish: () => void = () => {};
    const enter = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const unregister = registerPortalFx({ enter, exit: vi.fn(async () => {}), release: vi.fn() });

    const playing = playPortalEnter(HEX);
    expect(portalFxBusy.value).toBe(true);
    expect(enter).toHaveBeenCalledWith(HEX);
    finish();
    await playing;

    expect(portalFxBusy.value).toBe(false);
    unregister();
  });

  it('frees the lock even when the animation throws', async () => {
    const unregister = registerPortalFx({
      enter: () => Promise.reject(new Error('boom')),
      exit: async () => {},
      release: () => {},
    });

    await expect(playPortalEnter(HEX)).rejects.toThrow('boom');

    expect(portalFxBusy.value).toBe(false);
    unregister();
  });

  it('holdPortalFxFor locks for the given time and release reaches the board', () => {
    vi.useFakeTimers();
    const release = vi.fn();
    const unregister = registerPortalFx({ enter: async () => {}, exit: async () => {}, release });

    holdPortalFxFor(300);
    expect(portalFxBusy.value).toBe(true);
    vi.advanceTimersByTime(300);
    expect(portalFxBusy.value).toBe(false);

    releasePortalFx();
    expect(release).toHaveBeenCalled();
    unregister();
    vi.useRealTimers();
  });

  it('REQ-1: unregistering the board drops its hold timers and frees the lock', () => {
    vi.useFakeTimers();
    const unregister = registerPortalFx({
      enter: async () => {},
      exit: async () => {},
      release() {},
    });
    holdPortalFxFor(300);

    unregister();

    expect(vi.getTimerCount()).toBe(0);
    expect(portalFxBusy.value).toBe(false);
    vi.useRealTimers();
  });

  it('REQ-1: an animation of the old board finishing late never frees the new board', async () => {
    vi.useFakeTimers();
    let finishOld: () => void = () => {};
    const unregisterOld = registerPortalFx({
      enter: () => new Promise<void>((resolve) => (finishOld = resolve)),
      exit: async () => {},
      release() {},
    });
    const oldPlay = playPortalEnter(HEX);
    unregisterOld();
    const unregisterNew = registerPortalFx({
      enter: async () => {},
      exit: async () => {},
      release() {},
    });
    holdPortalFxFor(300);

    finishOld();
    await oldPlay;

    expect(portalFxBusy.value).toBe(true);
    vi.advanceTimersByTime(300);
    expect(portalFxBusy.value).toBe(false);
    unregisterNew();
    vi.useRealTimers();
  });

  it('stays busy until the longest of overlapping holds ends', () => {
    vi.useFakeTimers();
    const unregister = registerPortalFx({
      enter: async () => {},
      exit: async () => {},
      release() {},
    });

    holdPortalFxFor(300);
    holdPortalFxFor(500);
    vi.advanceTimersByTime(300);
    expect(portalFxBusy.value).toBe(true);
    vi.advanceTimersByTime(200);
    expect(portalFxBusy.value).toBe(false);

    unregister();
    vi.useRealTimers();
  });
});
