<template>
  <section class="battle-tab" data-testid="battle-tab">
    <div
      v-if="battleStore.waiting || battleStore.connectionLost"
      class="battle-tab__status"
      data-testid="battle-waiting"
      role="status"
    >
      {{ battleStore.connectionLost ? t('battle.connectionLost') : t('battle.waiting') }}
    </div>
    <template v-if="view.stage !== 'deploy'">
      <battle-initiative-strip :round="view.round" :chips="view.chips" />

      <div class="battle-tab__heading is-allies">{{ t('battle.allies') }}</div>
      <battle-hero-controls
        v-if="view.hero"
        :card="view.hero"
        :swapping="ui.mode === 'swap'"
        @take-hit="takeHit"
        @pick-hand="pickHand"
        @pick-action="pickAction"
        @swap="swapFrom"
        @undo="undo"
        @end-turn="endTurn"
        @leave="leave"
      />
      <battle-creature-row v-for="row in view.friends" :key="row.id" :row="row" />

      <div class="battle-tab__divider"><span>⚔</span></div>

      <div class="battle-tab__heading is-enemies">
        {{ t('battle.enemies') }}
        <small>{{ t('battle.enemiesLeft', { count: view.enemiesLeft }) }}</small>
      </div>
      <battle-creature-row
        v-for="row in view.enemies"
        :key="row.id"
        :row="row"
        @select="selectEnemy"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useBattleView } from '@/composables/use-battle-view';
import BattleInitiativeStrip from './battle-initiative-strip.vue';
import { useBattleReaction } from '@/composables/use-battle-reaction';
import BattleHeroControls from './battle-hero-controls.vue';
import BattleCreatureRow from './battle-creature-row.vue';
import { useBattleStore } from '@/stores/battle-store';

const { t } = useI18n();
const battleStore = useBattleStore();
const { view, ui, selectEnemy, takeHit, pickHand, pickAction, swapFrom, undo, endTurn, leave } =
  useBattleView();
useBattleReaction();
</script>

<style scoped>
.battle-tab__status {
  font-size: 12px;
  opacity: 0.7;
}

.battle-tab {
  display: grid;
  align-content: start;
  gap: 10px;
  height: 100%;
  padding: 14px;
  overflow-y: auto;
  background: #191d20;
  color: #ede3d2;
  font-family: 'Alegreya Sans', sans-serif;
  scrollbar-width: none;
}
.battle-tab::-webkit-scrollbar {
  display: none;
}
.battle-tab__heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #36424a;
  font-family: Cinzel, serif;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.battle-tab__heading.is-allies {
  color: #8fc0f0;
}
.battle-tab__heading.is-enemies {
  color: #f08a7a;
}
.battle-tab__heading small {
  color: #8e9599;
  font-family: 'Alegreya Sans', sans-serif;
  letter-spacing: 0;
  text-transform: none;
}
.battle-tab__divider {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #c2412d;
}
.battle-tab__divider::before,
.battle-tab__divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #36424a;
}
</style>
