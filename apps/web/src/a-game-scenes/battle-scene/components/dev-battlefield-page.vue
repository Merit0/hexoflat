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
        <input v-model="ambush" data-testid="dev-battlefield-ambush" type="checkbox" />
        Ambush
      </label>
      <label>
        <input v-model="showZones" data-testid="dev-battlefield-zones" type="checkbox" />
        Deployment zones
      </label>
      <label>
        Overlay
        <select v-model="mode" data-testid="dev-battlefield-mode">
          <option value="">none</option>
          <option value="move">move</option>
          <option value="strike">strike</option>
          <option value="push">push</option>
          <option value="pull">pull</option>
        </select>
      </label>
      <span v-if="error" class="dev-battlefield__error">{{ error }}</span>
    </form>
    <battle-board
      v-if="view"
      class="dev-battlefield__board"
      :scene="view.scene"
      :overlay="view.overlay"
      :banner="view.banner"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import BattleBoard from '@/components/battle/battle-board.vue';
import type { BattleTargetMode } from '@/render/battle/battle-overlay-model';
import {
  DEV_APPROACHES as APPROACHES,
  buildDevBattlefield,
} from '@/a-game-scenes/battle-scene/dev-battlefield';

const seed = ref('bone-crypt-1');
const approach = ref('west');
const ambush = ref(false);
const showZones = ref(true);
const mode = ref<BattleTargetMode | ''>('');

const built = computed(() => {
  try {
    const view = buildDevBattlefield({
      seed: seed.value,
      approach: approach.value,
      ambush: ambush.value,
      showZones: showZones.value,
      mode: mode.value || null,
    });
    return { view, error: '' };
  } catch (failure) {
    return { view: null, error: failure instanceof Error ? failure.message : String(failure) };
  }
});

const view = computed(() => built.value.view);
const error = computed(() => built.value.error);
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
  gap: 16px;
  padding: 10px 16px;
  font-size: 13px;
}

.dev-battlefield__error {
  color: #e0503c;
}

.dev-battlefield__board {
  flex: 1;
  min-height: 0;
}
</style>
