<template>
  <div class="stage-bar" data-testid="battle-stage-bar">
    <button
      v-for="stage in stages"
      :key="stage.id"
      class="stage"
      :class="{ 'is-current': stage.current }"
      type="button"
      :data-testid="`battle-stage-${stage.id}`"
      :data-state="stage.current ? 'current' : 'idle'"
      @click="emit('pick', stage.id)"
    >
      {{ t(`battle.stage.${stage.id}`) }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { BattleStage, BattleStageView } from '@/composables/battle-stage';

defineProps<{ stages: BattleStageView[] }>();
const emit = defineEmits<{ pick: [stage: BattleStage] }>();
const { t } = useI18n();
</script>

<style scoped>
.stage-bar {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}
.stage {
  padding: 6px 4px;
  border-radius: 10px;
  border: 1px solid #2e363a;
  background: #121517;
  color: #8e9599;
  font-family: Cinzel, serif;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.stage.is-current {
  border-color: #4a8be0;
  color: #ede3d2;
}
</style>
