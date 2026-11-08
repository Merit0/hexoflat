import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computed, createApp, defineComponent, nextTick, type App, type ComputedRef } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useStashOpening } from './use-stash-opening';

let app: App;
let probe: ReturnType<typeof useStashOpening>;
let tool: ComputedRef<unknown>;

describe('useStashOpening', () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    tool = computed(() => useHeroToolStore().activeTool);
    useWorldMapStore().map = {
      tiles: [
        { coordinates: { columnIndex: 1, rowIndex: 1 }, hexobject: { hexobjectKey: K.FIREPLACE } },
        {
          coordinates: { columnIndex: 8, rowIndex: 9 },
          hexobject: { hexobjectKey: K.STASH_CHEST },
        },
      ],
    } as never;
    const Probe = defineComponent({
      setup() {
        probe = useStashOpening(tool);
        return () => null;
      },
    });
    app = createApp(Probe).use(pinia);
    app.mount(document.createElement('div'));
  });
  afterEach(() => app.unmount());

  it('does nothing while the stash is closed', () => {
    useHeroToolStore().activeTool = K.HAND;
    expect(probe.isOpening.value).toBe(false);
    expect(probe.anchor.value).toBeNull();
  });

  it('keeps the tool working on the chest hex while the stash is open', async () => {
    useHeroToolStore().activeTool = K.HAND;
    useHeroStashStore().open();
    await nextTick();
    expect(probe.isOpening.value).toBe(true);
    expect(probe.anchor.value).toEqual({ columnIndex: 8, rowIndex: 9 });
  });

  it('needs a tool in the hand to work', () => {
    useHeroToolStore().activeTool = null;
    useHeroStashStore().open();
    expect(probe.isOpening.value).toBe(false);
  });

  it('stops the tool when the stash closes, like the Book of Will does', async () => {
    const heroTool = useHeroToolStore();
    const stash = useHeroStashStore();
    heroTool.activeTool = K.HAND;
    stash.open();
    await nextTick();
    stash.close();
    await nextTick();
    expect(heroTool.activeTool).toBeNull();
    expect(heroTool.isDragging).toBe(false);
  });
});
