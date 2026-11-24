import { useBattleStore } from '@/stores/battle-store';
import { testDeploy } from '@/stores/battle-store.fixture';
import { battleWith, hero, skeleton } from '@hexoflat/engine/battle/battle-test-setup';
import { projectBattleForViewer } from '@hexoflat/engine/battle/projection';
import { applyDamage } from '@hexoflat/engine/battle/battle-end';
import { battleUi, resetBattleUi } from '@/composables/battle-ui-state';
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
  resetBattleUi();
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
  resetBattleUi();
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
      expect(tool.heroHex).toEqual(questPosition);
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
    expect(tool.heroHex).toEqual(worldPosition);
    expect(hexDistance(tool.hover!, worldPosition)).toBe(1);
  });

  it('uses the saved world position again after the quest context is removed', () => {
    questRun.value = { position: questPosition } as QuestProjection;
    host.querySelector<HTMLButtonElement>('button')!.click();
    const tool = useHeroToolStore();
    expect(tool.heroHex).toEqual(questPosition);
    tool.stopTool();
    questRun.value = null;
    host.querySelector<HTMLButtonElement>('button')!.click();
    expect(tool.heroHex).toEqual(worldPosition);
  });
});

describe('Inventory USE on the hand in a battle', () => {
  it.each([false, true])('only activates the hand when all enemies are dead: %s', (won) => {
    const creatures = [hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })];
    const store = useBattleStore();
    store.prepare(testDeploy(creatures), ['hero']);
    const state = battleWith(creatures);
    if (won) applyDamage(state, state.creatures[1], state.creatures[1].hp);
    store.projection = projectBattleForViewer(state, 'heroes');
    host.querySelector<HTMLButtonElement>('button')!.click();
    expect(battleUi.stage).toBe(won ? 'action' : 'move');
    expect(battleUi.hand).toBe(won ? 'right' : null);
  });
});
