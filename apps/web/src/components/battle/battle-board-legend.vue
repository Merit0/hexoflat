<template>
  <div class="battle-legend" data-testid="battle-legend">
    <span v-for="key in ITEMS" :key="key" class="battle-legend__item">
      {{ t(`battle.legend.${key}`, PARAMS) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { BATTLE_RULES } from '@hexoflat/engine/battle/battle-content';
import { BATTLE_LEGEND_ITEMS as ITEMS } from '@/render/battle/battle-look';

const PARAMS = { cost: BATTLE_RULES.step.rubble, weight: BATTLE_RULES.boulderWeight };

const { t } = useI18n();
</script>

<style scoped>
.battle-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 18px;
  padding: 8px 16px;
  background: #121517;
  border-top: 1px solid #36424a;
  color: #cbbfa6;
  font-family: 'Alegreya Sans', sans-serif;
  font-size: 0.85rem;
}
</style>
