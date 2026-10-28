<template>
  <div class="actions">
    <button
      v-for="action in actions"
      :key="action.id"
      class="action"
      :class="[`is-${action.id}`, { 'is-selected': action.selected }]"
      type="button"
      :disabled="action.disabled"
      :data-testid="`battle-action-${action.id}`"
      @click="emit('pick', action.id)"
    >
      <span class="action__label">{{ t(`battle.action.${action.id}`) }}</span>
      <span class="action__cost">{{ t('battle.will', { will: action.cost }) }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { BattleActionId, BattleActionView } from '@/composables/battle-hero-card';

defineProps<{ actions: BattleActionView[] }>();
const emit = defineEmits<{ pick: [id: BattleActionId] }>();
const { t } = useI18n();
</script>

<style scoped>
.actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.action {
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: 8px 4px;
  border-radius: 10px;
  border: 1px solid #4a5862;
  background: #1e2427;
  color: #ede3d2;
  font: inherit;
}
.action.is-strike {
  border-color: #a0285a;
  background: linear-gradient(180deg, #7e1a40, #5a0f2c);
}
.action.is-selected {
  border-color: #e0a93f;
  background: linear-gradient(180deg, #5a4214, #2e2410);
}
.action:disabled {
  opacity: 0.4;
  cursor: default;
}
.action__label {
  text-transform: uppercase;
  font-family: Cinzel, serif;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.06em;
}
.action__cost {
  color: #cbbfa6;
  font-size: 0.75rem;
}
</style>
