<template>
  <div
    class="tip"
    :class="{ 'tip--square': square }"
    :style="{ '--rarity': rarityColor }"
    data-testid="item-tooltip"
  >
    <div class="tip__frame">
      <div class="tip__body">
        <header class="tip__head">
          <div class="tip__rarity-row">
            <span class="tip__rarity">{{ rarityLabel }}</span>
            <span v-if="view.equipped" class="tip__badge" data-testid="item-tooltip-equipped">{{
              t('itemTooltip.equipped')
            }}</span>
          </div>
          <h4 class="tip__title" data-testid="item-tooltip-title">{{ t(view.title) }}</h4>
          <p class="tip__type">{{ typeLabel }}</p>
        </header>

        <section v-if="view.headline" class="tip__headline">
          <span class="tip__value" data-testid="item-tooltip-headline">{{ headlineValue }}</span>
          <span class="tip__label">{{ headlineLabel }}</span>
          <span
            v-if="comparison"
            class="tip__compare"
            :class="`is-${comparison.direction}`"
            data-testid="item-tooltip-compare"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path :d="comparison.icon" />
            </svg>
            {{ comparison.text }}
          </span>
        </section>

        <ul v-if="capabilityLabels.length" class="tip__chips">
          <li v-for="label in capabilityLabels" :key="label" class="tip__chip">{{ label }}</li>
        </ul>

        <p
          v-if="view.use?.kind === 'locked'"
          class="tip__will-note"
          data-testid="item-tooltip-will-locked"
        >
          {{ t('itemTooltip.willLocked') }}
        </p>

        <ul v-if="view.shields > 0 || view.hearts > 0" class="tip__bonuses">
          <li v-if="view.shields > 0" class="tip__bonus" data-testid="item-tooltip-shields">
            <img class="tip__bonus-icon" :src="SHIELD_ICON_URL" alt="" />
            {{ t('itemTooltip.shields', { count: view.shields }) }}
          </li>
          <li v-if="view.hearts > 0" class="tip__bonus" data-testid="item-tooltip-hearts">
            <img class="tip__bonus-icon" :src="HEART_ICON_URL" alt="" />
            {{ t('itemTooltip.hearts', { count: view.hearts }) }}
          </li>
        </ul>

        <p v-if="view.description" class="tip__flavor">{{ t(view.description) }}</p>

        <footer class="tip__foot">
          <span class="tip__stat" :title="t('itemTooltip.footer.weight')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="ICON_PATHS.weight" /></svg>
            {{ view.footer.weightKg }} {{ t('itemTooltip.footer.weightUnit') }}
          </span>
          <span v-if="view.footer.durabilityMax !== undefined" class="tip__stat">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="ICON_PATHS.durability" /></svg>
            {{ durabilityText }}
          </span>
          <span
            v-if="view.use"
            class="tip__stat"
            :title="t('itemTooltip.willUse', { will: view.use.will })"
            data-testid="item-tooltip-will"
          >
            <svg v-if="useIcon" viewBox="0 0 24 24" aria-hidden="true"><path :d="useIcon" /></svg>
            <span>
              {{ t('itemTooltip.footer.will') }}:
              <span data-testid="item-tooltip-will-price">{{ view.use.will }}</span>
            </span>
          </span>
          <span v-if="view.footer.stack" class="tip__stat" :title="t('itemTooltip.footer.stack')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="ICON_PATHS.stack" /></svg>
            {{ stackText }}
          </span>
        </footer>
      </div>
    </div>

    <div class="tip__medal" aria-hidden="true">
      <div class="tip__medal-core">
        <svg viewBox="0 0 24 24"><path :d="ICON_PATHS[iconName]" /></svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ItemTooltipView } from '@hexoflat/engine/utils/inventory/item-tooltip';
import {
  EQUIP_SLOT_ICON,
  ICON_PATHS,
  ITEM_ICON_BY_KEY,
  type TIconName,
} from '@/components/gui/icons/item-icons';
import { SKILL_ICON } from '@/components/gui/icons/skill-presentation';
import { RARITY_COLOR } from '@/render/rarity';
import { useItemTooltipLabels } from './use-item-tooltip-labels';

const SHIELD_ICON_URL = '/board-assets/hero-board/shield-icon.png';
const HEART_ICON_URL = '/board-assets/hero-board/heart-icon.png';

const props = defineProps<{ view: ItemTooltipView; square?: boolean }>();
const { t } = useI18n();
const labels = useItemTooltipLabels();

const rarityColor = computed(() => RARITY_COLOR[props.view.rarityTone]);
const rarityLabel = computed(() => labels.value.rarity[props.view.rarity.kind]);
const typeLabel = computed(() =>
  props.view.equipSlot
    ? labels.value.slot[props.view.equipSlot]
    : labels.value.group[props.view.group],
);
const iconName = computed<TIconName>(
  () =>
    ITEM_ICON_BY_KEY[props.view.key] ??
    (props.view.equipSlot ? EQUIP_SLOT_ICON[props.view.equipSlot] : 'chest'),
);

const headlineLabel = computed(() =>
  props.view.headline ? labels.value.headline[props.view.headline.kind] : '',
);
const headlineValue = computed(() => {
  const headline = props.view.headline;
  if (!headline) return '';
  if (headline.kind === 'multiplier') return `×${headline.max}`;
  return headline.min === headline.max ? `${headline.max}` : `${headline.min}–${headline.max}`;
});
const useSkillId = computed(() => props.view.use?.skillId ?? null);
const useIcon = computed(() =>
  useSkillId.value ? ICON_PATHS[SKILL_ICON[useSkillId.value]] : null,
);
const comparison = computed(() => {
  const result = props.view.headline?.comparison;
  if (!result || result.direction === 'same') return null;
  const better = result.direction === 'better';
  return {
    direction: result.direction,
    icon: better ? ICON_PATHS.better : ICON_PATHS.worse,
    text: `${better ? '+' : '−'}${Math.abs(result.delta)}`,
  };
});

const capabilityLabels = computed(() =>
  props.view.capabilities.map((capability) => labels.value.capability[capability]),
);
const durabilityText = computed(
  () => `${t('itemTooltip.footer.durability')} ${props.view.footer.durabilityMax}`,
);
const stackText = computed(() => {
  const stack = props.view.footer.stack;
  if (!stack) return '';
  return stack.max ? `${stack.amount} / ${stack.max}` : `${stack.amount}`;
});
</script>

<style scoped>
.tip {
  --body: #14120e;
  --ink: #e8e0cf;
  --muted: #a39886;
  --flavor: #bfa77c;
  position: relative;
  width: 360px;
  padding-top: 26px;
  color: var(--ink);
  font-family: 'Alegreya Sans', var(--font-main, serif), sans-serif;
  filter: drop-shadow(0 14px 28px rgba(0, 0, 0, 0.6));
}
.tip__frame {
  background: color-mix(in srgb, var(--rarity) 60%, #000);
  clip-path: polygon(
    0 30px,
    50% 0,
    100% 30px,
    100% calc(100% - 18px),
    calc(100% - 18px) 100%,
    18px 100%,
    0 calc(100% - 18px)
  );
  padding: 2px;
}
.tip__body {
  display: grid;
  gap: 12px;
  padding: 44px 20px 0;
  background:
    radial-gradient(
      120% 60% at 50% 0%,
      color-mix(in srgb, var(--rarity) 12%, transparent),
      transparent 70%
    ),
    var(--body);
  clip-path: polygon(
    0 28px,
    50% 0,
    100% 28px,
    100% calc(100% - 17px),
    calc(100% - 17px) 100%,
    17px 100%,
    0 calc(100% - 17px)
  );
}
.tip__head {
  display: grid;
  gap: 2px;
  text-align: center;
}
.tip__rarity-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}
.tip__rarity {
  color: var(--rarity);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.tip__badge {
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid #59d3c2;
  color: #59d3c2;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.tip__title {
  margin: 0;
  color: var(--rarity);
  font-family: 'Alegreya SC', var(--font-main, serif), serif;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.1;
}
.tip__type {
  margin: 0;
  color: var(--muted);
  font-size: 0.85rem;
}
.tip__headline {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px solid #2e281f;
}
.tip__value {
  font-size: 2.4rem;
  font-weight: 800;
  line-height: 1;
}
.tip__label {
  color: var(--muted);
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.tip__compare {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 700;
}
.tip__compare svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.tip__compare.is-better {
  color: #7bd88f;
  background: rgba(123, 216, 143, 0.12);
}
.tip__compare.is-worse {
  color: #f08a7a;
  background: rgba(240, 138, 122, 0.12);
}
.tip__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.tip__chip {
  padding: 2px 10px;
  border: 1px solid #2e281f;
  border-radius: 999px;
  background: #1b1812;
  color: #cfc5b2;
  font-size: 0.78rem;
}
.tip__bonuses {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.tip__bonus {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--rarity);
  font-size: 1.05rem;
  font-weight: 800;
  text-align: left;
}
.tip__will-note {
  margin: 0;
  color: #d9a066;
  font-size: 0.82rem;
  font-weight: 700;
  text-align: center;
}
.tip__bonus-icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
}
.tip__flavor {
  margin: 0;
  color: var(--flavor);
  font-size: 0.9rem;
  font-style: italic;
  text-align: center;
}
.tip__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin: 0 -20px;
  padding: 10px 20px 14px;
  background: #0e0c09;
  border-top: 1px solid #2a241c;
  color: #cfc5b2;
  font-size: 0.8rem;
}
.tip__stat {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.tip__stat svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.tip--square {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
}
.tip--square .tip__frame,
.tip--square .tip__body {
  clip-path: none;
  box-sizing: border-box;
  height: 100%;
}
.tip--square .tip__frame {
  border-radius: 6px;
}
.tip--square .tip__body {
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  overflow: hidden;
}
.tip--square .tip__foot {
  margin-top: auto;
}
.tip__medal {
  position: absolute;
  top: 0;
  left: 50%;
  width: 60px;
  height: 66px;
  transform: translateX(-50%);
  background: var(--rarity);
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
}
.tip__medal-core {
  position: absolute;
  inset: 3px;
  display: grid;
  place-items: center;
  background: #0f0d0a;
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  color: var(--rarity);
}
.tip__medal-core svg {
  width: 28px;
  height: 28px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
