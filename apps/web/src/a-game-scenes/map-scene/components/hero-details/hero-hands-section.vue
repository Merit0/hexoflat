<template>
  <hero-details-card class="hands" data-testid="hero-details-state">
    <div
      v-for="(hand, index) in hands"
      :key="hand.id"
      class="hand"
      :style="{ '--rarity': hand.color }"
      :data-testid="`hero-hand-${hand.id}`"
    >
      <span
        class="hand__icon"
        :class="{ 'is-mirrored': hand.id === 'left' }"
        role="img"
        :aria-label="hand.label"
        :title="hand.label"
        :data-testid="`hero-hand-${hand.id}-label`"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" :data-testid="`hero-hand-${hand.id}-icon`">
          <path :d="ICON_PATHS.hand" />
        </svg>
      </span>
      <span v-if="hand.title" class="hand__name" :data-testid="`hero-hand-${hand.id}-name`">{{
        hand.title
      }}</span>
      <span v-else class="hand__empty" :data-testid="`hero-hand-${hand.id}-empty`">{{
        labels.hands.empty
      }}</span>
      <span
        v-if="index === 0"
        class="hands__divider"
        :style="{ background: dividerBackground }"
        data-testid="hero-hands-divider"
      ></span>
    </div>
  </hero-details-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { HeroDetailsView } from '@/composables/use-hero-details';
import { ICON_PATHS } from '@/components/gui/icons/item-icons';
import { RARITY_COLOR } from '@/render/rarity';
import HeroDetailsCard from './hero-details-card.vue';
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

const dividerBackground = computed(
  () => `linear-gradient(180deg, ${hands.value[0].color}, ${hands.value[1].color})`,
);
</script>

<style scoped>
.hands {
  position: relative;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  padding: 0;
}
.hands .hand {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  min-height: 72px;
  padding: 0 18px;
}
.hand__icon {
  flex: none;
  display: grid;
  place-items: center;
  color: #cbbfa6;
}
.hand__icon svg {
  width: 30px;
  height: 30px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.hand__icon.is-mirrored svg {
  transform: scaleX(-1);
}
.hand__name {
  min-width: 0;
  color: var(--rarity);
  font-family: 'Alegreya SC', serif;
  font-size: 1.2rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.hand__empty {
  color: #a39886;
  font-style: italic;
}
.hands__divider {
  position: absolute;
  top: 14px;
  right: 0;
  bottom: 14px;
  width: 2px;
  border-radius: 2px;
  opacity: 0.8;
}
</style>
