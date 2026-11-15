import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { HexMapBuilder } from '@hexoflat/engine/map/builders/hex-map-builder';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { i18n } from '@/i18n';
import { knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useTraderStore } from '@/stores/trader-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import ToolHexTile from './tool-hex-tile.vue';

const HERO_AT = { columnIndex: 1, rowIndex: 1 };
const STALL_AT = { columnIndex: 1, rowIndex: 0 };

let app: App;
let host: HTMLElement;

const actButton = () => host.querySelector<HTMLElement>('[data-testid="tool-action-button"]');

describe('the hand tool on the trader stall', () => {
  beforeEach(async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const map = new HexMapBuilder().name('stall-test').width(3).height(3).build();
    for (const tile of map.tiles) tile.isRevealed = true;
    const stall = map.tiles.find(
      (tile) =>
        tile.coordinates.columnIndex === STALL_AT.columnIndex &&
        tile.coordinates.rowIndex === STALL_AT.rowIndex,
    )!;
    stall.hexobject = HexObjectFactory.create(K.TRADER_STALL, stall.coordinates);
    useWorldMapStore().map = map;
    useHeroStore().heroCoordinates = { ...HERO_AT };
    useHeroToolStore().useTool(K.HAND, HERO_AT, STALL_AT);
    host = document.createElement('div');
    document.body.appendChild(host);
    app = createApp({ render: () => h(ToolHexTile, { tileWidth: 60, tileHeight: 52 }) })
      .use(pinia)
      .use(i18n);
    app.mount(host);
    await nextTick();
  });
  afterEach(() => {
    app.unmount();
    host.remove();
  });

  it('offers ENTER and opens the shop of that trader without a server action', async () => {
    expect(actButton()?.textContent?.trim()).toBe(i18n.global.t('tool.enter'));

    actButton()!.click();
    await nextTick();

    expect(useTraderStore().traderKey).toBe('ilva');
  });
});

describe('the hand reading the quest board', () => {
  const BOARD_AT = { columnIndex: 1, rowIndex: 0 };
  const TREE_AT = { columnIndex: 0, rowIndex: 1 };

  beforeEach(async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const map = new HexMapBuilder().name('board-test').width(3).height(3).build();
    for (const tile of map.tiles) tile.isRevealed = true;
    const at = (coords: typeof BOARD_AT) =>
      map.tiles.find(
        (tile) =>
          tile.coordinates.columnIndex === coords.columnIndex &&
          tile.coordinates.rowIndex === coords.rowIndex,
      )!;
    at(BOARD_AT).hexobject = HexObjectFactory.create(K.QUEST_BOARD, BOARD_AT);
    at(TREE_AT).hexobject = HexObjectFactory.create(K.TREE, TREE_AT);
    useWorldMapStore().map = map;
    useHeroStore().heroCoordinates = { ...HERO_AT };
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    inventory.putToInventory(K.PICKAXE, 1);
    inventory.moveItemToSlot(
      inventory.items.find((item) => item.key === K.PICKAXE)!.id,
      'eq:weapon',
    );
    useHeroToolStore().useTool(K.HAND, HERO_AT, BOARD_AT);
    knowledgePanelMode.value = 'quests';
    host = document.createElement('div');
    document.body.appendChild(host);
    app = createApp({ render: () => h(ToolHexTile, { tileWidth: 60, tileHeight: 52 }) })
      .use(pinia)
      .use(i18n);
    app.mount(host);
    await nextTick();
  });
  afterEach(() => {
    knowledgePanelMode.value = null;
    app.unmount();
    host.remove();
  });

  it('keeps the hand while the board is read, even when the pointer crosses a tree', async () => {
    const tool = useHeroToolStore();
    tool.updateHover(TREE_AT);
    await nextTick();

    expect(tool.activeTool).toBe(K.HAND);
  });
});
