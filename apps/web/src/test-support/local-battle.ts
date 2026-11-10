import type { BattleAction } from '@hexoflat/engine/battle/battle-commands';
import type { BattleState } from '@hexoflat/engine/battle/battle-state';
import { projectBattleForViewer } from '@hexoflat/engine/battle/projection';
import { createDevBattleBridge } from '@/a-game-scenes/battle-scene/dev-battle-bridge';
import { useBattleStore } from '@/stores/battle-store';

let cached: ReturnType<typeof create> | null = null;

export function localBattle() {
  const store = useBattleStore();
  if (cached?.store === store) return cached;
  cached = create(store);
  return cached;
}

function create(store: ReturnType<typeof useBattleStore>) {
  let now = 0;
  const bridge = createDevBattleBridge(
    () => store.deploy?.setup ?? null,
    () => store.close(),
    () => now,
  );
  store.bindBridge(bridge);

  return {
    store,
    bridge,
    state(): BattleState {
      const state = bridge.peek();
      if (!state) throw new Error('No local battle');
      return state;
    },
    set(next: BattleState) {
      bridge.replace(next);
      store.projection = projectBattleForViewer(next, 'heroes');
    },
    act(action: BattleAction, atMs = 0) {
      now = atMs;
      return store.act(action);
    },
    actAll(actions: BattleAction[], atMs = 0) {
      now = atMs;
      return store.actAll(actions);
    },
    runEnemyTurn(atMs = 0) {
      now = atMs;
      return store.runEnemyTurn();
    },
  };
}
