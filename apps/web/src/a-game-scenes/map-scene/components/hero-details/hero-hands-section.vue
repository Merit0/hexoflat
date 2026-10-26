<template>
  <hero-details-card class="hands" data-testid="hero-details-state">
    <div
      v-for="(hand, index) in hands"
      :key="hand.id"
      class="hand"
      :style="{ '--rarity': hand.color }"
      :data-testid="`hero-hand-${hand.id}`"
    >
      <button
        class="hand__icon"
        :class="{ 'is-mirrored': hand.id === 'left', 'is-clickable': !!hand.title }"
        type="button"
        :disabled="!hand.title"
        :aria-label="
          hand.title ? t('heroDetails.hands.emptyAction', { hand: hand.label }) : hand.label
        "
        :title="hand.title ? t('heroDetails.hands.emptyAction', { hand: hand.label }) : hand.label"
        :data-testid="`hero-hand-${hand.id}-label`"
        @click="emit('unequip', hand.id)"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" :data-testid="`hero-hand-${hand.id}-icon`">
          <path :d="ICON_PATHS.hand" />
        </svg>
      </button>
      <span v-if="hand.title" class="hand__text">
        <span class="hand__name" :data-testid="`hero-hand-${hand.id}-name`">{{ hand.title }}</span>
        <span
          v-if="hand.willCost !== null"
          class="hand__will"
          :data-testid="`hero-hand-${hand.id}-will`"
        >
          {{ t('itemTooltip.footer.will') }}: {{ hand.willCost }}
        </span>
      </span>
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
const emit = defineEmits<{ unequip: ['right' | 'left'] }>();
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
      willCost: item?.willCost ?? null,
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
  padding: 0;
  border: 0;
  background: none;
  color: #cbbfa6;
  cursor: default;
}
.hand__icon.is-clickable {
  cursor: pointer;
}
.hand__icon.is-clickable {
  animation: hand-shake 5s ease-in-out infinite;
}
@keyframes hand-shake {
  0%,
  86%,
  100% {
    transform: rotate(0);
  }
  88% {
    transform: rotate(-14deg);
  }
  90% {
    transform: rotate(12deg);
  }
  92% {
    transform: rotate(-10deg);
  }
  94% {
    transform: rotate(8deg);
  }
  96% {
    transform: rotate(-4deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .hand__icon.is-clickable {
    animation: none;
  }
}
.hand__icon.is-clickable:hover {
  animation: none;
  color: var(--rarity);
  filter: drop-shadow(0 0 6px var(--rarity));
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
.hand__text {
  display: grid;
  min-width: 0;
}
.hand__will {
  color: #a39886;
  font-size: 0.85rem;
  font-weight: 700;
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
