<template>
  <div
    class="unique"
    :style="{ '--light': preview.lightColor }"
    :data-light="preview.lightName"
    data-testid="quest-unique-reward"
  >
    <b class="name">{{ preview.name }}</b>
    <span
      v-for="row in preview.ranges"
      :key="row.key"
      :data-testid="`quest-unique-reward-${row.key}`"
      >{{ row.label }} {{ row.range }}</span
    >
    <em data-testid="quest-unique-reward-note">{{ t('quest.reward.rolled') }}</em>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { UniqueRewardPreview } from '@/services/quests/quest-unique-reward';

defineProps<{ preview: UniqueRewardPreview }>();
const { t } = useI18n();
</script>

<style scoped>
.unique {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}
.name {
  color: var(--light);
}
em {
  color: var(--q-label);
}
</style>
