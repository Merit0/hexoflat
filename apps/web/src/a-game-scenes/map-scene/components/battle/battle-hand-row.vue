<template>
  <button
    class="hand-row"
    :class="[`is-${hand.kind}`, { 'is-selected': hand.selected }]"
    type="button"
    :disabled="hand.disabled"
    :data-testid="`battle-hand-${hand.hand}`"
    @click="emit('pick', hand.hand)"
  >
    <span class="hand-row__label">{{ t(`battle.hand.${hand.hand}`) }}</span>
    <span class="hand-row__bar"></span>
    <span class="hand-row__item">
      {{ hand.itemKey ? t(`content.battle.${hand.itemKey}.title`) : t('battle.hand.empty') }}
    </span>
    <span class="hand-row__meta">{{ text(hand.meta) }}</span>
  </button>
</template>

<script setup lang="ts">
import type { BattleHand } from '@hexoflat/engine/battle/battle-state';
import type { BattleHandView } from '@/composables/battle-hero-card';
import { useBattleText } from '@/composables/use-battle-view';

defineProps<{ hand: BattleHandView }>();
const emit = defineEmits<{ pick: [hand: BattleHand] }>();
const { t, text } = useBattleText();
</script>

<style scoped>
.hand-row {
  display: grid;
  grid-template-columns: 92px 2px 1fr auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 40px;
  padding: 6px 12px;
  border-radius: 10px;
  border: 1px solid #2e363a;
  background: #121517;
  color: #ede3d2;
  font: inherit;
  text-align: left;
}
.hand-row:disabled {
  cursor: default;
}
.hand-row.is-selected {
  border-color: #4a8be0;
}
.hand-row.is-consumable {
  border-color: #7a3a34;
}
.hand-row__label {
  color: #8e9599;
  font-family: Cinzel, serif;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.hand-row__bar {
  align-self: stretch;
  border-radius: 2px;
  background: #3a474e;
}
.is-selected .hand-row__bar {
  background: #4a8be0;
}
.is-consumable .hand-row__bar {
  background: #c2412d;
}
.hand-row__item {
  text-transform: capitalize;
  font-family: Cinzel, serif;
  font-weight: 700;
}
.is-selected .hand-row__item {
  color: #5aa0f2;
}
.is-shield .hand-row__item {
  color: #8fc0f0;
}
.is-consumable .hand-row__item {
  color: #f08a7a;
}
.is-empty .hand-row__item {
  color: #8e9599;
  font-style: italic;
}
.hand-row__meta {
  color: #8e9599;
  font-size: 0.8rem;
}
</style>
