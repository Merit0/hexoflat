<template>
  <span class="dimension">{{ t('dimensions.label', { name: names[dimension] }) }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { EDimension } from '@hexoflat/engine/dimensions/dimensions';

defineProps<{ dimension: EDimension }>();
const { t } = useI18n();
const names = computed(() => ({
  [EDimension.HEAVEN]: t('dimensions.heaven'),
  [EDimension.EARTH]: t('dimensions.earth'),
  [EDimension.UNDERWORLD]: t('dimensions.underworld'),
  [EDimension.NOWHERE]: t('dimensions.nowhere'),
}));
</script>

<style scoped>
.dimension {
  color: var(--muted, #a39886);
  font-size: 0.78rem;
  line-height: 1.4;
}
</style>
