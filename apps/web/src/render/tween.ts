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

  const handler = () => {
    const progress = Math.min(1, (performance.now() - start) / durationMs);
    onFrame(progress);
    if (progress >= 1) {
      Ticker.shared.remove(handler);
      finish();
    }
  };
  Ticker.shared.add(handler);

  return {
    done,
    cancel() {
      Ticker.shared.remove(handler);
      finish();
    },
  };
}
