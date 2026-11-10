import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, provide } from 'vue';
import { createPinia, getActivePinia, setActivePinia } from 'pinia';
import { hero, skeleton } from '@hexoflat/engine/battle/battle-test-setup';
import { apiClient } from '@/api/client';
import { i18n } from '@/i18n';
import { BATTLE_STORE_KEY } from '@/composables/battle-store-context';
import { useBattleView } from '@/composables/use-battle-view';
import { createBattleStore, useBattleStore } from '@/stores/battle-store';
import { testDeploy } from '@/stores/battle-store.fixture';
import { createDevBattleBridge } from './dev-battle-bridge';

const FORBIDDEN = [
  'world-map-store',
  'hero-store',
  'hero-inventory-store',
  'hero-stash-store',
  'inventory-sync',
  'inventory-bridge',
  'battle-server',
  'squad-flow',
  '@/api/client',
];

function source(relative: string): string {
  return readFileSync(resolve(__dirname, relative), 'utf8');
}

describe('the dev battlefield is isolated from the game (REQ-B41-ISO-001)', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it.each(['components/dev-battlefield-page.vue', 'dev-battle-bridge.ts', 'dev-battlefield.ts'])(
    '%s imports nothing of the world, the inventory or the server',
    (file) => {
      const imports = source(file)
        .split('\n')
        .filter((line) => /^\s*(import|\} from)\b/.test(line) || /from '/.test(line))
        .join('\n');
      for (const name of FORBIDDEN) expect(imports).not.toContain(name);
    },
  );

  it('plays on its own store instance and leaves the game store and the server alone', async () => {
    const appPinia = getActivePinia()!;
    const gameStore = useBattleStore();
    const spies = [
      vi.spyOn(apiClient, 'get'),
      vi.spyOn(apiClient, 'post'),
      vi.spyOn(apiClient, 'putJson'),
      vi.spyOn(apiClient, 'patch'),
    ];
    const devStore = createBattleStore('dev-battle-store')();
    devStore.bindBridge(
      createDevBattleBridge(
        () => devStore.deploy?.setup ?? null,
        () => devStore.close(),
      ),
    );
    devStore.prepare(testDeploy([hero({ q: 0, r: 0 }), skeleton('s1', { q: 3, r: 0 })]), ['hero']);

    let seen: ReturnType<typeof useBattleView>['view']['value'] | null = null;
    const Child = defineComponent({
      setup() {
        const { view } = useBattleView();
        return () => {
          seen = view.value;
          return h('div');
        };
      },
    });
    const Root = defineComponent({
      setup() {
        provide(BATTLE_STORE_KEY, devStore);
        return () => h(Child);
      },
    });
    createApp(Root).use(i18n).use(appPinia).mount(document.createElement('div'));

    expect(await devStore.start()).toBe(true);
    expect(devStore.projection).not.toBeNull();
    expect(seen).not.toBeNull();
    expect(devStore.$id).not.toBe(gameStore.$id);
    expect(gameStore.projection).toBeNull();
    expect(gameStore.inBattle).toBe(false);
    expect(gameStore.deploy).toBeNull();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
