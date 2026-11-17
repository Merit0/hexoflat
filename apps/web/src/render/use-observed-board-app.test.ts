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
  reject(error: Error): void;
}

const created = vi.hoisted(() => ({ pending: [] as Pending[] }));

vi.mock('@/render/pixi-app', () => ({
  createHexBoardApp: (_canvas: HTMLCanvasElement, width: number, height: number) =>
    new Promise<HexBoardApp>((resolve, reject) => {
      const destroy = vi.fn<() => void>();
      const app = { destroy } as unknown as HexBoardApp;
      created.pending.push({
        size: { width, height },
        app,
        destroy,
        resolve: () => resolve(app),
        reject,
      });
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
  onError?: ObservedBoardAppOptions['onError'];
};

let app: App | null = null;

function mount(hooks: Hooks): void {
  const host = document.createElement('div');
  app = createApp(
    defineComponent({
      setup() {
        const pane = ref<HTMLElement | null>(null);
        const canvas = ref<HTMLCanvasElement | null>(null);
        useObservedBoardApp({ pane, canvas, source: 'test-board', ...hooks });
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
    onError: vi.fn(),
  };
}

function liveApps(): number {
  return created.pending.filter((one) => one.destroy.mock.calls.length === 0).length;
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

  describe('a start that fails (MAPFIX-6 REQ-5)', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    it('destroys the created app when the textures fail to load, and surfaces the error', async () => {
      const failure = new Error('preload failed');
      const spy = { ...hooks(), prepare: vi.fn(() => Promise.reject(failure)) };
      mount(spy);
      observe!(800, 600);
      created.pending[0].resolve();
      await settle();

      expect(liveApps()).toBe(0);
      expect(spy.onStart).not.toHaveBeenCalled();
      expect(spy.onError).toHaveBeenCalledWith(failure);
      expect(console.error).toHaveBeenCalledWith('[board] test-board failed to start', failure);

      observe!(900, 700);
      await settle();
      expect(created.pending).toHaveLength(1);
      expect(liveApps()).toBe(0);
      expect(spy.onResize).not.toHaveBeenCalled();
    });

    it('surfaces a failed Pixi init and never starts a second app on a later resize', async () => {
      const failure = new Error('webgl lost');
      const spy = hooks();
      mount(spy);
      observe!(800, 600);
      created.pending[0].reject(failure);
      await settle();
      observe!(820, 640);
      await settle();

      expect(created.pending).toHaveLength(1);
      expect(spy.onError).toHaveBeenCalledWith(failure);
      expect(spy.onStart).not.toHaveBeenCalled();
    });

    it('keeps at most one live app when the pane resizes while the failing start is still loading', async () => {
      let fail: (error: Error) => void = () => {};
      const spy = {
        ...hooks(),
        prepare: vi.fn(() => new Promise<void>((_resolve, reject) => (fail = reject))),
      };
      mount(spy);
      observe!(800, 600);
      created.pending[0].resolve();
      await settle();
      observe!(820, 600);
      expect(liveApps()).toBeLessThanOrEqual(1);

      fail(new Error('preload failed'));
      await settle();
      observe!(840, 600);
      await settle();

      expect(created.pending).toHaveLength(1);
      expect(liveApps()).toBe(0);
      expect(spy.onError).toHaveBeenCalledTimes(1);
    });
  });
});
