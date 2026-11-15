import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, defineComponent, h, ref, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useTraderStore } from '@/stores/trader-store';
import {
  HAND_SCROLL_COOLDOWN_MS,
  useHexBoardInput,
  type UseHexBoardInputDeps,
} from './use-hex-board-input';

let app: App;
let host: HTMLElement;
const position = ref({ columnIndex: 12, rowIndex: 12 });
const enabled = ref(true);
const blocked = ref(false);
let inputDeps: UseHexBoardInputDeps;
const InputHarness = defineComponent({
  setup() {
    useHexBoardInput(inputDeps);
    return () => h('div');
  },
});

function scroll() {
  window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, cancelable: true }));
}

describe('the mouse wheel takes the hand only when no hand action is running', () => {
  beforeEach(() => {
    enabled.value = true;
    blocked.value = false;
    const pinia = createPinia();
    setActivePinia(pinia);
    localStorage.clear();
    useHeroInventoryStore().hydrate();
    useHeroStore().heroCoordinates = { columnIndex: 2, rowIndex: 2 };
    const tool = useHeroToolStore();
    tool.stopTool();
    host = document.createElement('div');
    inputDeps = { hoveredTileCoord: ref(null) };
    app = createApp(InputHarness).use(pinia);
    app.mount(host);
  });
  afterEach(() => {
    knowledgePanelMode.value = null;
    app.unmount();
  });

  it('uses the quest hero position and bypasses the reading-panel block only for the quest input', () => {
    app.unmount();
    knowledgePanelMode.value = 'quests';
    const pinia = createPinia();
    setActivePinia(pinia);
    useHeroInventoryStore().hydrate();
    inputDeps = { hoveredTileCoord: ref(null), heroCoordinates: position, enabled, blocked };
    app = createApp(InputHarness).use(pinia);
    app.mount(host);
    scroll();
    const tool = useHeroToolStore();
    expect(tool.isDragging).toBe(true);
    expect(tool.origin).toEqual(position.value);
    tool.stopTool();
    enabled.value = false;
    scroll();
    expect(tool.isDragging).toBe(false);
  });

  it('arms the hand when the hero is idle', () => {
    scroll();
    expect(useHeroToolStore().isDragging).toBe(true);
    expect(HAND_SCROLL_COOLDOWN_MS).toBeGreaterThan(0);
  });

  it('does nothing while a world action locks the tool', () => {
    const tool = useHeroToolStore();
    tool.isLocked = true;
    scroll();
    expect(tool.isDragging).toBe(false);
  });

  it('does nothing while another board holds the tool (quest hand working)', () => {
    const tool = useHeroToolStore();
    tool.holdTool();
    scroll();
    expect(tool.isDragging).toBe(false);
    tool.releaseTool();
    expect(tool.isBusy).toBe(false);
  });

  it.each([
    ['the quest board or the Book of Will is read', () => (knowledgePanelMode.value = 'quests')],
    ['the stash is open', () => (useHeroStashStore().isOpen = true)],
    ['the shop is open', () => useTraderStore().open('ilva')],
  ])('does nothing while %s', (_name, setUp) => {
    setUp();
    scroll();
    expect(useHeroToolStore().isDragging).toBe(false);
    expect(useHeroToolStore().activeTool).not.toBe(K.PICKAXE);
  });
});
