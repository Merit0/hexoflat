<template>
  <div class="init-strip">
    <div class="init-strip__round" data-testid="battle-round">
      <span class="init-strip__label">{{ t('battle.round') }}</span>
      <b>{{ round }}</b>
    </div>
    <div class="init-strip__chips">
      <div
        v-for="chip in chips"
        :key="chip.id"
        class="init-chip"
        :class="[`is-${chip.state}`, `is-${chip.side}`]"
        :data-testid="`battle-init-chip-${chip.id}`"
      >
        <span class="init-chip__hex">{{ chip.num }}</span>
        <span class="init-chip__name">{{ chip.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { BattleInitChip } from '@/composables/battle-view';

defineProps<{ round: number; chips: BattleInitChip[] }>();
const { t } = useI18n();
</script>

<style scoped>
.init-strip {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 14px;
  border-radius: 14px;
  background: #121517;
  border: 1px solid #36424a;
}
.init-strip__round {
  display: grid;
  justify-items: center;
  padding-right: 14px;
  border-right: 1px solid #36424a;
  color: #e8d7a8;
  font-family: Cinzel, serif;
}
.init-strip__round b {
  font-size: 1.5rem;
  line-height: 1;
}
.init-strip__label {
  color: #cbbfa6;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
}
.init-strip__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.init-chip {
  display: grid;
  justify-items: center;
  gap: 2px;
  width: 44px;
}
.init-chip__hex {
  display: grid;
  place-items: center;
  width: 32px;
  height: 36px;
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  background: #2e4a66;
  color: #cbbfa6;
  font-family: Cinzel, serif;
  font-weight: 700;
}
.init-chip.is-enemies .init-chip__hex {
  background: #5a1a2e;
}
.init-chip.is-active .init-chip__hex {
  background: linear-gradient(160deg, #f0c060, #8c5a12);
  color: #1b1408;
}
.init-chip.is-done {
  opacity: 0.55;
}
.init-chip.is-fallen {
  opacity: 0.3;
}
.init-chip__name {
  max-width: 100%;
  overflow: hidden;
  color: #cbbfa6;
  font-size: 0.65rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
