import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createApp, defineComponent, h, ref, type App } from 'vue';
import type { HexBoardApp } from '@/render/pixi-app';
import type { PaneSize } from '@/render/board-camera';
import { useObservedBoardApp, type ObservedBoardAppOptions } from './use-observed-board-app';

interface Pending {
  size: PaneSize;
  app: HexBoardApp;
  destroy: Mock<() => void>;
  resolve(): void;
}

const created = vi.hoisted(() => ({ pending: [] as Pending[] }));

vi.mock('@/render/pixi-app', () => ({
  createHexBoardApp: (_canvas: HTMLCanvasElement, width: number, height: number) =>
    new Promise<HexBoardApp>((resolve) => {
      const destroy = vi.fn<() => void>();
      const app = { destroy } as unknown as HexBoardApp;
      created.pending.push({ size: { width, height }, app, destroy, resolve: () => resolve(app) });
    }),
}));

let observe: ((width: number, height: number) => void) | null = null;
const disconnect = vi.fn();

class FakeResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    observe = (width, height) =>
      callback(
        [{ contentRect: { width, height } } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
  }
  observe() {}
  disconnect() {
    disconnect();
  }
}

type Hooks = Pick<ObservedBoardAppOptions, 'onStart' | 'onResize' | 'onDispose'> & {
  prepare?: ObservedBoardAppOptions['prepare'];
};

let app: App | null = null;

function mount(hooks: Hooks): void {
  const host = document.createElement('div');
  app = createApp(
    defineComponent({
      setup() {
        const pane = ref<HTMLElement | null>(null);
        const canvas = ref<HTMLCanvasElement | null>(null);
        useObservedBoardApp({ pane, canvas, ...hooks });
        return () => h('div', { ref: pane }, [h('canvas', { ref: canvas })]);
      },
    }),
  );
  app.mount(host);
}

async function settle() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function hooks() {
  return {
    prepare: vi.fn(() => Promise.resolve()),
    onStart: vi.fn(),
    onResize: vi.fn(),
    onDispose: vi.fn(),
  };
}

beforeEach(() => {
  created.pending.length = 0;
  observe = null;
  disconnect.mockClear();
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
  app?.unmount();
  app = null;
  vi.unstubAllGlobals();
});

describe('observed board app', () => {
  it('creates one Pixi app when the pane resizes again while it is starting', async () => {
    const spy = hooks();
    mount(spy);
    observe!(800, 600);
    observe!(820, 600);
    observe!(840, 610);
    expect(created.pending).toHaveLength(1);

    created.pending[0].resolve();
    await settle();

    expect(created.pending).toHaveLength(1);
    expect(spy.onStart).toHaveBeenCalledTimes(1);
    expect(spy.onStart).toHaveBeenCalledWith(created.pending[0].app, { width: 840, height: 610 });
    expect(spy.onResize).not.toHaveBeenCalled();
  });

  it('starts with the pane size and resizes the started app afterwards', async () => {
    const spy = hooks();
    mount(spy);
    observe!(0, 600);
    expect(created.pending).toHaveLength(0);
    observe!(800, 600);
    expect(created.pending[0].size).toEqual({ width: 800, height: 600 });

    created.pending[0].resolve();
    await settle();
    observe!(900, 700);

    expect(spy.onResize).toHaveBeenCalledWith({ width: 900, height: 700 });
    expect(created.pending).toHaveLength(1);
  });

  it('destroys an app that finishes starting after the board was unmounted', async () => {
    const spy = hooks();
    mount(spy);
    observe!(800, 600);
    app!.unmount();
    app = null;

    created.pending[0].resolve();
    await settle();

    expect(created.pending[0].destroy).toHaveBeenCalledTimes(1);
    expect(spy.onStart).not.toHaveBeenCalled();
    expect(spy.onDispose).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('destroys the app when the board is unmounted while textures are still loading', async () => {
    let loaded: () => void = () => {};
    const spy = { ...hooks(), prepare: vi.fn(() => new Promise<void>((r) => (loaded = r))) };
    mount(spy);
    observe!(800, 600);
    created.pending[0].resolve();
    await settle();
    expect(spy.prepare).toHaveBeenCalledTimes(1);

    app!.unmount();
    app = null;
    loaded();
    await settle();

    expect(created.pending[0].destroy).toHaveBeenCalledTimes(1);
    expect(spy.onStart).not.toHaveBeenCalled();
  });

  it('releases the layers before it destroys the started app', async () => {
    const order: string[] = [];
    const spy = { ...hooks(), onDispose: vi.fn(() => order.push('layers')) };
    mount(spy);
    observe!(800, 600);
    created.pending[0].resolve();
    await settle();
    created.pending[0].destroy.mockImplementation(() => order.push('app'));

    app!.unmount();
    app = null;

    expect(order).toEqual(['layers', 'app']);
  });
});
