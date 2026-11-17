import { describe, expect, it } from 'vitest';
import { Ticker } from 'pixi.js';
import { registerHeroToken, renderStats, trackBoardApp } from './render-stats';

describe('render stats for the e2e guards', () => {
  it('counts a board app once however many times it is released', () => {
    const before = renderStats().liveApps;
    const release = trackBoardApp();
    expect(renderStats().liveApps).toBe(before + 1);
    release();
    release();
    expect(renderStats().liveApps).toBe(before);
  });

  it('reports the hero token of the board mounted last, and a late unregister of the old one keeps it', () => {
    const dropOld = registerHeroToken(() => false);
    const dropNew = registerHeroToken(() => true);
    dropOld();
    expect(renderStats().heroTokenSettled).toBe(true);
    dropNew();
    expect(renderStats().heroTokenSettled).toBeNull();
  });

  it('reads the listeners left on the shared ticker', () => {
    const before = renderStats().sharedTickerListeners;
    const listener = () => {};
    Ticker.shared.add(listener);
    expect(renderStats().sharedTickerListeners).toBe(before + 1);
    Ticker.shared.remove(listener);
    expect(renderStats().sharedTickerListeners).toBe(before);
  });
});
