import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { i18n } from '@/i18n';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { questRun } from '@/services/quests/quest-run-projection';
import type { QuestProjection } from '@hexoflat/engine/quests/projection';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { getHexNeighbors, hexDistance } from '@hexoflat/engine/utils/hex-utils';
import EquipToken from './equip-token.vue';

const worldPosition = { columnIndex: 2, rowIndex: 3 };
const questPosition = { columnIndex: 18, rowIndex: 16 };
let app: App;
let host: HTMLDivElement;

beforeEach(() => {
  localStorage.clear();
  const pinia = createPinia();
  setActivePinia(pinia);
  questRun.value = null;
  useHeroStore().heroCoordinates = worldPosition;
  host = document.createElement('div');
  document.body.append(host);
  app = createApp(EquipToken, {
    item: {
      id: 'hand-token',
      key: 'hand',
      type: EHexobjectGroup.TOOL,
      amount: 1,
      slotKey: 'eq:weapon',
      isNew: false,
    },
  })
    .use(pinia)
    .use(i18n);
  app.mount(host);
});

afterEach(() => {
  app.unmount();
  host.remove();
  questRun.value = null;
});

describe('Inventory hand position on the active map', () => {
  it.each(['[data-testid="equip-token-hand-token"]', 'button'])(
    'anchors %s beside the quest hero and allows orbit',
    (selector) => {
      questRun.value = { position: questPosition } as QuestProjection;
      host.querySelector<HTMLElement>(selector)!.click();
      const tool = useHeroToolStore();
      expect(tool.origin).toEqual(questPosition);
      expect(hexDistance(tool.hover!, questPosition)).toBe(1);
      const next = getHexNeighbors(questPosition)[1];
      tool.updateHover(next);
      expect(tool.hover).toEqual(next);
      expect(tool.isDragging).toBe(true);
    },
  );

  it('anchors beside the world hero when no quest is active', () => {
    host.querySelector<HTMLButtonElement>('button')!.click();
    const tool = useHeroToolStore();
    expect(tool.origin).toEqual(worldPosition);
    expect(hexDistance(tool.hover!, worldPosition)).toBe(1);
  });

  it('uses the saved world position again after the quest context is removed', () => {
    questRun.value = { position: questPosition } as QuestProjection;
    host.querySelector<HTMLButtonElement>('button')!.click();
    const tool = useHeroToolStore();
    expect(tool.origin).toEqual(questPosition);
    tool.stopTool();
    questRun.value = null;
    host.querySelector<HTMLButtonElement>('button')!.click();
    expect(tool.origin).toEqual(worldPosition);
  });
});
