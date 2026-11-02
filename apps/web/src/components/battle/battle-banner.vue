<template>
  <div class="battle-banner" data-testid="battle-banner">
    <span class="battle-banner__place">{{ t('battle.banner.round', { place, round }) }}</span>
    <span class="battle-banner__divider">|</span>
    <span class="battle-banner__actor">{{ t('battle.banner.willLeft', { actor, will }) }}</span>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { BattleBannerProps } from '@/render/battle/battle-banner';

defineProps<BattleBannerProps>();

const { t } = useI18n();
</script>

<style scoped>
.battle-banner {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 6px 16px;
  border: 1px solid #4a4236;
  border-radius: 6px;
  background: rgb(15 14 18 / 85%);
  color: #e8e2d4;
  font-family: Cinzel, serif;
  font-size: 13px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}

.battle-banner__divider {
  color: #6c6976;
}
</style>
