import { Ticker } from 'pixi.js';

export interface RenderStats {
  liveApps: number;
  sharedTickerListeners: number;
  heroTokenSettled: boolean | null;
}

let liveApps = 0;
let heroToken: (() => boolean) | null = null;

export function trackBoardApp(): () => void {
  liveApps += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    liveApps -= 1;
  };
}

export function registerHeroToken(settled: () => boolean): () => void {
  heroToken = settled;
  return () => {
    if (heroToken === settled) heroToken = null;
  };
}

export function renderStats(): RenderStats {
  return {
    liveApps,
    sharedTickerListeners: Ticker.shared.count,
    heroTokenSettled: heroToken ? heroToken() : null,
  };
}
