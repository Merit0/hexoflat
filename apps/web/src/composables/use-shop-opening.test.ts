import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computed, createApp, defineComponent, nextTick, type App, type ComputedRef } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useTraderStore } from '@/stores/trader-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { traderAtStall, useShopOpening } from './use-shop-opening';

let app: App;
let probe: ReturnType<typeof useShopOpening>;
let tool: ComputedRef<unknown>;

describe('traderAtStall', () => {
  it('names the trader of a stall and nobody for other objects', () => {
    expect(traderAtStall(K.TRADER_STALL)).toBe('ilva');
    expect(traderAtStall(K.STASH_CHEST)).toBeNull();
    expect(traderAtStall(undefined)).toBeNull();
  });
});

describe('useShopOpening', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    tool = computed(() => useHeroToolStore().activeTool);
    useWorldMapStore().map = {
      tiles: [
        { coordinates: { columnIndex: 1, rowIndex: 1 }, hexobject: { hexobjectKey: K.FIREPLACE } },
        {
          coordinates: { columnIndex: 10, rowIndex: 9 },
          hexobject: { hexobjectKey: K.TRADER_STALL },
        },
      ],
    } as never;
    const Probe = defineComponent({
      setup() {
        probe = useShopOpening(tool);
        return () => null;
      },
    });
    app = createApp(Probe).use(pinia);
    app.mount(document.createElement('div'));
  });
  afterEach(() => app.unmount());

  it('does nothing while the shop is closed', () => {
    useHeroToolStore().activeTool = K.HAND;
    expect(probe.isOpening.value).toBe(false);
    expect(probe.anchor.value).toBeNull();
  });

  it('keeps the tool working on the stall hex while the shop is open', async () => {
    useHeroToolStore().activeTool = K.HAND;
    useTraderStore().open('ilva');
    await nextTick();
    expect(probe.isOpening.value).toBe(true);
    expect(probe.anchor.value).toEqual({ columnIndex: 10, rowIndex: 9 });
  });

  it('needs a tool in the hand to work', () => {
    useHeroToolStore().activeTool = null;
    useTraderStore().open('ilva');
    expect(probe.isOpening.value).toBe(false);
  });

  it('stops the tool when the shop closes', async () => {
    const heroTool = useHeroToolStore();
    const trader = useTraderStore();
    heroTool.activeTool = K.HAND;
    trader.open('ilva');
    await nextTick();
    trader.close();
    await nextTick();
    expect(heroTool.activeTool).toBeNull();
    expect(heroTool.isDragging).toBe(false);
  });
});
