import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, ref, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useTraderStore } from '@/stores/trader-store';
import { questRun } from '@/services/quests/quest-run-projection';
import type { QuestProjection } from '@hexoflat/engine/quests/projection';
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
let inputDeps: Omit<UseHexBoardInputDeps, 'surface'>;
let givenSurface: HTMLElement | null = null;
const InputHarness = defineComponent({
  setup() {
    const surface = ref<HTMLElement | null>(givenSurface);
    useHexBoardInput({ ...inputDeps, surface });
    const boardRef = givenSurface ? undefined : surface;
    return () =>
      h('div', [
        h('div', { ref: boardRef, 'data-role': 'board' }, [h('span', { 'data-role': 'tile' })]),
        h('aside', { 'data-role': 'panel' }, [h('p', { 'data-role': 'panel-text' })]),
      ]);
  },
});

function wheelOn(role: string): WheelEvent {
  const event = new WheelEvent('wheel', { deltaY: 100, cancelable: true, bubbles: true });
  host.querySelector(`[data-role="${role}"]`)!.dispatchEvent(event);
  return event;
}

function scroll() {
  wheelOn('tile');
}

describe('the mouse wheel takes the hand only when no hand action is running', () => {
  beforeEach(() => {
    givenSurface = null;
    enabled.value = true;
    questRun.value = null;
    blocked.value = false;
    const pinia = createPinia();
    setActivePinia(pinia);
    localStorage.clear();
    useHeroInventoryStore().hydrate();
    useHeroStore().heroCoordinates = { columnIndex: 2, rowIndex: 2 };
    const tool = useHeroToolStore();
    tool.stopTool();
    host = document.createElement('div');
    document.body.appendChild(host);
    inputDeps = { hoveredTileCoord: ref(null) };
    app = createApp(InputHarness).use(pinia);
    app.mount(host);
  });
  afterEach(() => {
    knowledgePanelMode.value = null;
    questRun.value = null;
    app.unmount();
    host.remove();
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

  it.each(['weapon', 'shield'] as const)(
    'prioritizes the hand equipped in %s on the first scroll',
    (slot) => {
      const inventory = useHeroInventoryStore();
      for (const item of inventory.items) {
        if (item.slotKey === 'eq:weapon' || item.slotKey === 'eq:shield')
          item.key = item.slotKey === `eq:${slot}` ? K.HAND : K.AXE;
      }
      scroll();
      expect(useHeroToolStore().activeTool).toBe(K.HAND);
    },
  );

  it('cycles from the actual tool when it was activated outside the wheel', () => {
    const inventory = useHeroInventoryStore();
    const shield = inventory.items.find((item) => item.slotKey === 'eq:shield')!;
    shield.key = K.AXE;
    const tool = useHeroToolStore();
    tool.useTool(K.AXE, { columnIndex: 2, rowIndex: 2 });
    scroll();
    expect(tool.activeTool).toBe(K.HAND);
  });

  it('uses the active quest position by default without a board-specific origin override', () => {
    questRun.value = { position: position.value } as QuestProjection;
    scroll();
    expect(useHeroToolStore().origin).toEqual(position.value);
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

  it('REQ-1: the wheel over the board opens the ring and the next turn rotates it', () => {
    const inventory = useHeroInventoryStore();
    const shield = inventory.items.find((item) => item.slotKey === 'eq:shield')!;
    shield.key = K.AXE;
    const now = vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const tool = useHeroToolStore();

    const opening = wheelOn('tile');
    expect(opening.defaultPrevented).toBe(true);
    expect(tool.isDragging).toBe(true);
    expect(tool.activeTool).toBe(K.HAND);

    now.mockReturnValue(10_000 + HAND_SCROLL_COOLDOWN_MS);
    const turning = wheelOn('board');
    expect(turning.defaultPrevented).toBe(true);
    expect(tool.activeTool).toBe(K.AXE);
    now.mockRestore();
  });

  it('REQ-2: the wheel over a side panel leaves the ring alone and scrolls natively', () => {
    const tool = useHeroToolStore();
    const closed = wheelOn('panel-text');
    expect(closed.defaultPrevented).toBe(false);
    expect(tool.isDragging).toBe(false);

    scroll();
    const openTool = tool.activeTool;
    const overPanel = wheelOn('panel');
    expect(overPanel.defaultPrevented).toBe(false);
    expect(tool.isDragging).toBe(true);
    expect(tool.activeTool).toBe(openTool);
  });

  it('REQ-3: after the board unmounts no wheel listener is left on the window or the board', () => {
    const board = document.createElement('div');
    const boardAdd = vi.spyOn(board, 'addEventListener');
    const boardRemove = vi.spyOn(board, 'removeEventListener');
    const windowAdd = vi.spyOn(window, 'addEventListener');
    const windowRemove = vi.spyOn(window, 'removeEventListener');
    givenSurface = board;
    const pinia = createPinia();
    setActivePinia(pinia);
    useHeroInventoryStore().hydrate();
    const boardApp = createApp(InputHarness).use(pinia);
    boardApp.mount(document.createElement('div'));
    boardApp.unmount();
    givenSurface = null;
    const wheelOnly = (calls: unknown[][]) => calls.filter(([type]) => type === 'wheel');
    const added = wheelOnly(boardAdd.mock.calls);
    const removed = wheelOnly(boardRemove.mock.calls);
    const onWindow = wheelOnly([...windowAdd.mock.calls, ...windowRemove.mock.calls]);
    vi.restoreAllMocks();

    expect(onWindow).toEqual([]);
    expect(added).toHaveLength(1);
    expect(removed).toHaveLength(1);
    expect(removed[0][1]).toBe(added[0][1]);
    board.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, cancelable: true }));
    expect(useHeroToolStore().isDragging).toBe(false);
  });
});
