<template>
  <div class="dev-battlefield" data-testid="dev-battlefield">
    <form class="dev-battlefield__controls" @submit.prevent>
      <label>
        Seed
        <input v-model="seed" data-testid="dev-battlefield-seed" type="text" />
      </label>
      <label>
        Hero comes from
        <select v-model="approach" data-testid="dev-battlefield-approach">
          <option v-for="(_, name) in APPROACHES" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>
      <label>
        Squad
        <select v-model="squad" data-testid="dev-battlefield-squad">
          <option v-for="(_, name) in SQUADS" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>
      <label>
        <input v-model="ambush" data-testid="dev-battlefield-ambush" type="checkbox" />
        Ambush
      </label>
      <label>
        <input v-model="withFriend" data-testid="dev-battlefield-friend" type="checkbox" />
        Friend (hot seat)
      </label>
      <button type="button" data-testid="dev-battlefield-restart" @click="prepare">
        New battle
      </button>
      <span v-if="error" class="dev-battlefield__error">{{ error }}</span>
    </form>
    <div class="dev-battlefield__play">
      <battle-board-area
        v-if="store.isOpen"
        class="dev-battlefield__board"
        :reference-frame="DEV_REFERENCE_FRAME"
      />
      <aside class="dev-battlefield__panel">
        <battle-tab v-if="store.isOpen" />
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import { BATTLE_STORE_KEY } from '@/composables/battle-store-context';
import {
  DEV_APPROACHES as APPROACHES,
  DEV_SQUADS as SQUADS,
  buildDevBattle,
  DEV_REFERENCE_FRAME,
} from '@/a-game-scenes/battle-scene/dev-battlefield';
import BattleBoardArea from '@/a-game-scenes/map-scene/components/battle/battle-board-area.vue';
import BattleTab from '@/a-game-scenes/map-scene/components/battle/battle-tab.vue';
import { resetBattleUi } from '@/composables/use-battle-view';
import { createBattleStore } from '@/stores/battle-store';
import { createDevBattleBridge } from '@/a-game-scenes/battle-scene/dev-battle-bridge';
import { useBattleEnemyDriver } from '@/services/battle/use-battle-enemy-driver';

const store = createBattleStore('dev-battle-store')();
provide(BATTLE_STORE_KEY, store);
const bridge = createDevBattleBridge(
  () => store.deploy?.setup ?? null,
  () => store.close(),
);
store.bindBridge(bridge);
useBattleEnemyDriver(undefined, store);

const seed = ref('bone-crypt-1');
const approach = ref('west');
const squad = ref('bone-court');
const ambush = ref(false);
const withFriend = ref(false);
const error = ref('');

function prepare() {
  try {
    const { deploy, heroIds } = buildDevBattle({
      seed: seed.value,
      approach: approach.value,
      ambush: ambush.value,
      squad: squad.value,
      withFriend: withFriend.value,
    });
    resetBattleUi();
    bridge.reset();
    store.prepare(deploy, heroIds);
    error.value = '';
  } catch (failure) {
    store.close();
    error.value = failure instanceof Error ? failure.message : String(failure);
  }
}

watch([seed, approach, squad, ambush, withFriend], () => {
  if (!store.projection) prepare();
});

onMounted(prepare);
onBeforeUnmount(() => {
  store.close();
  store.bindBridge(null);
});
</script>

<style scoped>
.dev-battlefield {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0f0e12;
  color: #e8e2d4;
}

.dev-battlefield__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  font-size: 13px;
}

.dev-battlefield__error {
  color: #e0503c;
}

.dev-battlefield__play {
  flex: 1;
  min-height: 0;
  display: flex;
}

.dev-battlefield__board {
  flex: 1;
  min-width: 0;
}

.dev-battlefield__panel {
  flex: none;
  width: 560px;
  max-width: 50vw;
  min-height: 0;
  border-left: 1px solid #36424a;
}
</style>
