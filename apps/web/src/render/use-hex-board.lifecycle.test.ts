import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, createApp, defineComponent, h, ref, type App } from 'vue';
import { Ticker } from 'pixi.js';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { IDENTITY_CAMERA } from '@/render/board-camera';
import { PORTAL_FX } from '@/render/portal-fx-config';
import { playPortalEnter, portalFxBusy } from '@/render/portal-fx';
import {
  finishLootFlights,
  lootFlightRequest,
  lootFlying,
  startLootFlights,
} from '@/services/loot/loot-flight-state';
import { useHexBoard } from './use-hex-board';

const store = vi.hoisted(() => ({ markTilesDirty: vi.fn() }));

vi.mock('@/render/texture-cache', async () => {
  const { Texture } = await import('pixi.js');
  return { getTexture: () => Texture.EMPTY, onTextureReady: () => () => {} };
});

vi.mock('@/render/pixi-app', async () => {
  const { Container: PixiContainer } = await import('pixi.js');
  return {
    createHexBoardApp: () =>
      Promise.resolve({
        worldContainer: new PixiContainer(),
        resize: () => {},
        setCamera: () => {},
        renderNow: () => {},
        onFirstFramePresented: () => {},
        destroy: () => {},
      }),
  };
});

vi.mock('@/render/layers/tiles-layer', () => ({
  createTilesLayer: () => ({ syncTiles: () => {}, syncLockChips: () => {}, destroy: () => {} }),
}));

vi.mock('@/stores/world-map-store', () => ({
  useWorldMapStore: () => ({
    consumeDirtyTileIds: () => new Set<string>(),
    markTilesDirty: store.markTilesDirty,
    currentLocationKey: 'camping',
  }),
}));

const HERO = { columnIndex: 2, rowIndex: 2 };
const NEXT = { columnIndex: 3, rowIndex: 2 };
const PORTAL = { columnIndex: 4, rowIndex: 4 };

const LOOT_PLAN = {
  flights: [
    {
      itemKey: HEXOBJECT_KEYS.SWORD,
      from: HERO,
      to: NEXT,
      delayMs: 0,
      landingKey: '3:2',
    },
  ],
  flightMs: 400,
  accentMs: 100,
  totalMs: 600,
};

function portalTile(coordinates: IHexCoordinates): IHexTile {
  return {
    coordinates,
    hexobject: { hexobjectKey: HEXOBJECT_KEYS.RETURN_PORTAL },
  } as unknown as IHexTile;
}

let now = 1_000;
const tiles = ref<IHexTile[]>([]);
const dirtyTick = ref(0);
const hero = ref<IHexCoordinates | null>(HERO);
let app: App | null = null;

async function flush() {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

const Board = defineComponent({
  setup() {
    useHexBoard({
      canvasRef: ref(document.createElement('canvas')),
      canvasSize: computed(() => ({ width: 800, height: 600 })),
      camera: computed(() => IDENTITY_CAMERA),
      tiles: computed(() => tiles.value),
      tilesDirtyTick: computed(() => dirtyTick.value),
      boardKey: computed(() => 'camping-map'),
      heroCoordinates: computed(() => hero.value),
      healTickerNow: ref(0),
      movePreview: {
        segments: computed(() => []),
        markerCoord: computed(() => null),
        reachable: computed(() => false),
        markerKind: computed(() => 'move' as const),
      },
      squadWatched: computed(() => []),
      lootFlight: lootFlightRequest,
      onTileHover: () => {},
      onTileClick: () => {},
    });
    return () => h('div');
  },
});

async function mountBoard() {
  app = createApp(Board);
  app.mount(document.createElement('div'));
  await flush();
}

function unmountBoard() {
  app?.unmount();
  app = null;
}

async function openPortalOnTheBoard() {
  tiles.value = [portalTile(PORTAL)];
  await flush();
}

async function walkOneStep() {
  hero.value = NEXT;
  await flush();
}

function tick(ms: number) {
  now += ms;
  Ticker.shared.update(now);
}

describe('useHexBoard: nothing survives an unmount', () => {
  beforeAll(() => {
    createApp(Board);
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    tiles.value = [];
    hero.value = HERO;
    store.markTilesDirty.mockClear();
  });

  afterEach(() => {
    unmountBoard();
    finishLootFlights();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('REQ-1: leaving during a portal animation clears its timer and the busy lock', async () => {
    await mountBoard();
    await openPortalOnTheBoard();
    void playPortalEnter(PORTAL);
    tick(PORTAL_FX.openMs / 3);
    expect(portalFxBusy.value).toBe(true);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmountBoard();

    expect(vi.getTimerCount()).toBe(0);
    expect(portalFxBusy.value).toBe(false);
    await mountBoard();
    await flush();
    expect(portalFxBusy.value).toBe(false);
  });

  it('REQ-2: leaving during a loot flight clears its timer and nothing lands afterwards', async () => {
    await mountBoard();
    startLootFlights(LOOT_PLAN);
    await flush();
    tick(100);
    expect(lootFlying.value).toBe(true);

    unmountBoard();

    expect(vi.getTimerCount()).toBe(0);
    expect(lootFlying.value).toBe(false);
    vi.advanceTimersByTime(10_000);
    tick(10_000);
    await flush();
    expect(store.markTilesDirty).not.toHaveBeenCalled();
    expect(lootFlying.value).toBe(false);
  });

  it('REQ-4: mount and unmount leave the shared ticker as they found it', async () => {
    const before = Ticker.shared.count;
    await mountBoard();
    await openPortalOnTheBoard();
    await walkOneStep();
    startLootFlights(LOOT_PLAN);
    await flush();
    void playPortalEnter(PORTAL);
    expect(Ticker.shared.count).toBeGreaterThan(before);

    unmountBoard();

    expect(Ticker.shared.count).toBe(before);
  });
});
