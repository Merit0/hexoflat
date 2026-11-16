import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, shallowRef, type App } from 'vue';
import { i18n } from '@/i18n';
import type { ActiveMapContext } from '@/composables/use-active-map-context';
import GameplayBoardHost from './gameplay-board-host.vue';

const active = shallowRef<ActiveMapContext>({
  kind: 'world',
  mapId: 'world-1',
  heroPosition: null,
  objectAt: () => null,
});
const disposed: string[] = [];
const ports = vi.hoisted(() => ({
  startWorldLoop: vi.fn(),
  stopWorldLoop: vi.fn(),
  hide: vi.fn(),
  stopTool: vi.fn(),
  cancelLockedAction: vi.fn(),
}));
vi.mock('@/composables/use-active-map-context', () => ({ useActiveMapContext: () => active }));
vi.mock('@/stores/world-map-store', () => ({
  useWorldMapStore: () => ({ ...ports, map: null, worldLoadFailed: false }),
}));
vi.mock('@/stores/hero-tool-store', () => ({ useHeroToolStore: () => ports }));
vi.mock('@/composables/use-hex-hover-info', () => ({ useHexHoverInfo: () => ports }));
vi.mock('./world-map-board.vue', async () => {
  const { defineComponent, h, onUnmounted } = await import('vue');
  return {
    default: defineComponent({
      setup() {
        onUnmounted(() => disposed.push('world'));
        return () => h('canvas', { 'data-board': 'world' });
      },
    }),
  };
});
vi.mock('@/components/quest/quest-field-area.vue', async () => {
  const { defineComponent, h, onUnmounted } = await import('vue');
  return {
    default: defineComponent({
      setup() {
        onUnmounted(() => disposed.push('quest'));
        return () => h('canvas', { 'data-board': 'quest' });
      },
    }),
  };
});
vi.mock('./battle/battle-board-area.vue', async () => {
  const { defineComponent, h, onUnmounted } = await import('vue');
  return {
    default: defineComponent({
      setup() {
        onUnmounted(() => disposed.push('battle'));
        return () => h('canvas', { 'data-board': 'battle' });
      },
    }),
  };
});

let app: App;
let host: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  disposed.length = 0;
  active.value = { kind: 'world', mapId: 'world-1', heroPosition: null, objectAt: () => null };
  host = document.createElement('div');
  app = createApp(GameplayBoardHost, { stageElement: null }).use(i18n);
  app.mount(host);
});
afterEach(() => {
  app.unmount();
});

describe('one active gameplay board', () => {
  it('keeps the active tool through quest movement, chest and pickup snapshots', async () => {
    active.value = { ...active.value, kind: 'quest', mapId: 'treasure-seeker-map' };
    await nextTick();
    vi.clearAllMocks();
    for (let snapshot = 0; snapshot < 3; snapshot++) {
      active.value = { ...active.value, heroPosition: { columnIndex: snapshot, rowIndex: 2 } };
      await nextTick();
    }
    expect(ports.stopTool).not.toHaveBeenCalled();
    expect(ports.cancelLockedAction).not.toHaveBeenCalled();
    expect(disposed).toEqual(['world']);
  });
  it('disposes previous renderers rather than keeping hidden world/quest/battle boards', async () => {
    for (const kind of ['quest', 'battle', 'world'] as const) {
      const previous = active.value.kind;
      active.value = { ...active.value, kind, mapId: kind };
      await nextTick();
      expect(host.querySelectorAll('canvas')).toHaveLength(1);
      expect(host.querySelector('canvas')?.getAttribute('data-board')).toBe(kind);
      expect(disposed).toContain(previous);
    }
  });
  it('clears interaction state and stops background simulation when leaving the world', async () => {
    vi.clearAllMocks();
    active.value = { ...active.value, kind: 'quest' };
    await nextTick();
    expect(ports.stopTool).toHaveBeenCalled();
    expect(ports.hide).toHaveBeenCalled();
    expect(ports.stopWorldLoop).toHaveBeenCalled();
    expect(ports.startWorldLoop).not.toHaveBeenCalled();
  });
});
