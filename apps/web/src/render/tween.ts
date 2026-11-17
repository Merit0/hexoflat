import { Ticker } from 'pixi.js';
import { subscribeTicker } from '@/render/ticker-subscription';

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export interface Tween {
  done: Promise<void>;
  cancel(): void;
}

export function runTween(durationMs: number, onFrame: (progress: number) => void): Tween {
  const start = performance.now();
  let finish: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    finish = resolve;
  });

  const handler = () => {
    const progress = Math.min(1, (performance.now() - start) / durationMs);
    onFrame(progress);
    if (progress >= 1) stop();
  };
  const unsubscribe = subscribeTicker(Ticker.shared, handler, {
    source: 'tween',
    onFailure: () => finish(),
  });

  function stop() {
    unsubscribe();
    finish();
  }

  return { done, cancel: stop };
}
