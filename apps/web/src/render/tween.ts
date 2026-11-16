import { Ticker } from 'pixi.js';

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

  const stop = () => {
    Ticker.shared.remove(handler);
    finish();
  };

  const handler = () => {
    const progress = Math.min(1, (performance.now() - start) / durationMs);
    try {
      onFrame(progress);
    } catch (error) {
      stop();
      console.error('[tween] an animation frame failed and was stopped', error);
      return;
    }
    if (progress >= 1) stop();
  };
  Ticker.shared.add(handler);

  return { done, cancel: stop };
}
