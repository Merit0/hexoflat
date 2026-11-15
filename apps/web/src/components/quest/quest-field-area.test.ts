import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, shallowRef, type App } from 'vue';
import { createPinia } from 'pinia';
import type { QuestProjection } from '@hexoflat/engine/quests/projection';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { EMPTY_FIELD } from '@/services/quests/quest-field-model';
import QuestFieldArea from './quest-field-area.vue';

const actions = vi.hoisted(() => ({ openChest: vi.fn(), pickUp: vi.fn(), click: vi.fn() }));
const projection = shallowRef<QuestProjection | null>(null);
vi.mock('@/composables/use-quest-run-actions', () => ({ useQuestRunActions: () => actions }));
vi.mock('@/composables/use-quest-run-view', () => ({
  useQuestRunView: () => ({
    field: shallowRef(EMPTY_FIELD),
    run: {
      get value() {
        return projection.value ? { projection: projection.value } : null;
      },
    },
  }),
}));
vi.mock('@/render/quest/use-quest-board', () => ({
  useQuestBoard: (options: { onCamera: (camera: object) => void }) => options.onCamera({ zoom: 1 }),
}));
vi.mock('@/services/quests/quest-hand-duration', () => ({ questHandDurationMs: () => 400 }));
vi.mock('./quest-hex-info-tooltip.vue', () => ({ default: defineComponent(() => () => null) }));
vi.mock('./quest-tool-hex.vue', () => ({
  default: defineComponent({
    emits: ['act', 'hide'],
    setup(_, { emit }) {
      return () => h('button', { onClick: () => emit('act') }, 'act');
    },
  }),
}));

let app: App | null;
let host: HTMLElement;
let tool: ReturnType<typeof useHeroToolStore>;
function newRun(): QuestProjection {
  const start = { columnIndex: 12, rowIndex: 12 };
  return {
    offerId: 'seeker-1',
    phase: 'walking',
    outcome: null,
    start,
    position: start,
    path: [],
    opened: [],
    hintHex: null,
    chest: { hex: getHexNeighbors(start)[0] },
    stepCost: 1,
    backCost: 3,
  };
}
async function begin() {
  tool.useTool(HEXOBJECT_KEYS.HAND, projection.value!.position);
  await nextTick();
  host.querySelector('button')!.click();
  expect(tool.holds).toBe(1);
}
describe('quest hand action lifetime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    projection.value = newRun();
    host = document.createElement('div');
    document.body.append(host);
    const pinia = createPinia();
    app = createApp(QuestFieldArea).use(pinia);
    app.mount(host);
    tool = useHeroToolStore(pinia);
  });
  afterEach(() => {
    app?.unmount();
    host.remove();
    vi.useRealTimers();
  });
  it('opens the chest after waiting when the projection is unchanged', async () => {
    await begin();
    await vi.advanceTimersByTimeAsync(399);
    expect(actions.openChest).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(actions.openChest).toHaveBeenCalledOnce();
    expect(tool.holds).toBe(0);
  });
  it('cancels the pending action when the hand is hidden', async () => {
    await begin();
    tool.stopTool();
    await nextTick();
    await vi.advanceTimersByTimeAsync(400);
    expect(actions.openChest).not.toHaveBeenCalled();
    expect(tool.holds).toBe(0);
  });
  it('clears the timer and releases the hand when unmounted', async () => {
    await begin();
    app!.unmount();
    app = null;
    await nextTick();
    expect(vi.getTimerCount()).toBe(0);
    expect(tool.holds).toBe(0);
    await vi.advanceTimersByTimeAsync(400);
    expect(actions.openChest).not.toHaveBeenCalled();
    expect(actions.pickUp).not.toHaveBeenCalled();
  });
  it('cancels when another run of the same quest replaces the projection', async () => {
    await begin();
    projection.value = newRun();
    await nextTick();
    expect(vi.getTimerCount()).toBe(0);
    expect(tool.holds).toBe(0);
    await vi.advanceTimersByTimeAsync(400);
    expect(actions.openChest).not.toHaveBeenCalled();
  });
  it('cancels when leaving the quest before the timer finishes', async () => {
    await begin();
    projection.value = null;
    await vi.advanceTimersByTimeAsync(400);
    expect(actions.openChest).not.toHaveBeenCalled();
    expect(tool.holds).toBe(0);
  });
});
