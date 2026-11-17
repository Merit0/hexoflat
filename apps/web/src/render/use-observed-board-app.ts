import { onBeforeUnmount, onMounted, type Ref } from 'vue';
import { createHexBoardApp, type HexBoardApp } from '@/render/pixi-app';
import type { PaneSize } from '@/render/board-camera';

export interface ObservedBoardAppOptions {
  pane: Ref<HTMLElement | null>;
  canvas: Ref<HTMLCanvasElement | null>;
  prepare?: () => Promise<unknown>;
  onStart: (app: HexBoardApp, size: PaneSize) => void;
  onResize: (size: PaneSize) => void;
  onDispose: () => void;
}

export function useObservedBoardApp(options: ObservedBoardAppOptions): void {
  let app: HexBoardApp | null = null;
  let starting = false;
  let disposed = false;
  let observer: ResizeObserver | null = null;
  let latest: PaneSize | null = null;

  async function start() {
    const canvas = options.canvas.value;
    if (!canvas || !latest || app || starting) return;
    starting = true;
    try {
      const created = await createHexBoardApp(canvas, latest.width, latest.height);
      if (disposed) {
        created.destroy();
        return;
      }
      await options.prepare?.();
      if (disposed) {
        created.destroy();
        return;
      }
      app = created;
      options.onStart(created, latest);
    } finally {
      starting = false;
    }
  }

  onMounted(() => {
    const pane = options.pane.value;
    if (!pane) return;
    observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      latest = { width, height };
      if (app) options.onResize(latest);
      else void start();
    });
    observer.observe(pane);
  });

  onBeforeUnmount(() => {
    disposed = true;
    observer?.disconnect();
    observer = null;
    options.onDispose();
    app?.destroy();
    app = null;
  });
}
