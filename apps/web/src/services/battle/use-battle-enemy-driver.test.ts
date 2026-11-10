import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { giveTurn, hero, skeleton } from '@hexoflat/engine/battle/battle-test-setup';
import { localBattle } from '@/test-support/local-battle';
import { useBattleStore } from '@/stores/battle-store';
import { testDeploy } from '@/stores/battle-store.fixture';
import { useBattleEnemyDriver } from './use-battle-enemy-driver';

function mountDriver(delayMs: number) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const app = createApp(
    defineComponent({
      setup() {
        useBattleEnemyDriver(delayMs);
        return () => null;
      },
    }),
  );
  app.use(pinia);
  app.mount(document.createElement('div'));
  return app;
}

describe('battle enemy driver', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs the enemy turn after a pause and stops once the hero holds the turn', async () => {
    const app = mountDriver(200);
    const store = localBattle().store;
    store.prepare(testDeploy([hero({ q: 0, r: 0 }), skeleton('s1', { q: 2, r: 0 })]), ['hero']);
    await store.start();
    localBattle().set(giveTurn(structuredClone(localBattle().state()), ['s1', 'hero']));
    await nextTick();

    vi.advanceTimersByTime(199);
    expect(store.projection?.activeId).toBe('s1');
    await vi.advanceTimersByTimeAsync(1);
    expect(store.projection?.activeId).toBe('hero');

    await nextTick();
    vi.advanceTimersByTime(1000);
    expect(store.projection?.activeId).toBe('hero');
    app.unmount();
  });

  it('waits for the board animation and starts the pause only after it ends', async () => {
    const app = mountDriver(200);
    const store = localBattle().store;
    store.prepare(testDeploy([hero({ q: 0, r: 0 }), skeleton('s1', { q: 2, r: 0 })]), ['hero']);
    await store.start();
    store.setAnimating(true);
    localBattle().set(giveTurn(structuredClone(localBattle().state()), ['s1', 'hero']));
    await nextTick();

    vi.advanceTimersByTime(1000);
    expect(store.projection?.activeId).toBe('s1');
    store.setAnimating(false);
    await nextTick();
    vi.advanceTimersByTime(199);
    expect(store.projection?.activeId).toBe('s1');
    await vi.advanceTimersByTimeAsync(1);
    expect(store.projection?.activeId).toBe('hero');
    app.unmount();
  });

  it('cancels a scheduled enemy turn when unmounted', async () => {
    const app = mountDriver(200);
    const store = localBattle().store;
    store.prepare(testDeploy([hero({ q: 0, r: 0 }), skeleton('s1', { q: 2, r: 0 })]), ['hero']);
    await store.start();
    localBattle().set(giveTurn(structuredClone(localBattle().state()), ['s1', 'hero']));
    await nextTick();
    app.unmount();
    vi.advanceTimersByTime(500);
    expect(store.projection?.activeId).toBe('s1');
  });
});
