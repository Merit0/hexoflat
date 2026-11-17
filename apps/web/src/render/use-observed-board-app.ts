import { onBeforeUnmount, onMounted, type Ref } from 'vue';
import { createHexBoardApp, type HexBoardApp } from '@/render/pixi-app';
import type { PaneSize } from '@/render/board-camera';

export interface ObservedBoardAppOptions {
  pane: Ref<HTMLElement | null>;
  canvas: Ref<HTMLCanvasElement | null>;
  source: string;
  prepare?: () => Promise<unknown>;
  onStart: (app: HexBoardApp, size: PaneSize) => void;
  onResize: (size: PaneSize) => void;
  onDispose: () => void;
  onError?: (error: unknown) => void;
}

export function useObservedBoardApp(options: ObservedBoardAppOptions): void {
  let app: HexBoardApp | null = null;
  let starting = false;
  let failed = false;
  let disposed = false;
  let observer: ResizeObserver | null = null;
  let latest: PaneSize | null = null;

  function fail(error: unknown) {
    failed = true;
    console.error(`[board] ${options.source} failed to start`, error);
    options.onError?.(error);
  }

  async function start() {
    const canvas = options.canvas.value;
    if (!canvas || !latest || app || starting || failed) return;
    starting = true;
    let created: HexBoardApp | null = null;
    try {
      created = await createHexBoardApp(canvas, latest.width, latest.height);
      if (!disposed) await options.prepare?.();
      if (disposed) {
        created.destroy();
        return;
      }
      app = created;
      options.onStart(created, latest);
    } catch (error) {
      if (created && app !== created) created.destroy();
      if (!disposed) fail(error);
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
