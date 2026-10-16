<template>
  <div class="hands" data-testid="hero-details-state">
    <hero-hand-row
      v-for="hand in hands"
      :key="hand.id"
      :label="hand.label"
      :title="hand.title"
      :empty-label="labels.hands.empty"
      :color="hand.color"
      :data-testid="`hero-hand-${hand.id}`"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { HeroDetailsView } from '@/composables/use-hero-details';
import { RARITY_COLOR } from '@/render/rarity';
import HeroHandRow from './hero-hand-row.vue';
import { useHeroDetailsLabels } from './use-hero-details-labels';

const props = defineProps<{ view: HeroDetailsView }>();
const { t } = useI18n();
const labels = useHeroDetailsLabels();

const EMPTY_COLOR = '#3a474e';

const hands = computed(() =>
  (['right', 'left'] as const).map((id) => {
    const item = props.view.hands[id];
    return {
      id,
      label: labels.value.hands[id],
      title: item ? t(item.titleKey) : null,
      color: item?.rarity ? RARITY_COLOR[item.rarity] : EMPTY_COLOR,
    };
  }),
);
</script>

<style scoped>
.hands {
  display: grid;
  gap: 10px;
}
</style>
