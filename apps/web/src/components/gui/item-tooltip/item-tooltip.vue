<template>
  <div
    class="tip"
    :class="{ 'tip--square': square }"
    :style="{ '--light': lightColor }"
    data-testid="item-tooltip"
  >
    <div class="tip__frame">
      <div class="tip__body">
        <header class="tip__head">
          <div class="tip__token-type-row">
            <span class="tip__token-type" data-testid="item-tooltip-token-type">{{
              tokenTypeLabel
            }}</span>
            <span v-if="view.equipped" class="tip__badge" data-testid="item-tooltip-equipped">{{
              t('itemTooltip.equipped')
            }}</span>
          </div>
          <h4 class="tip__title" data-testid="item-tooltip-title">{{ title }}</h4>
          <p v-if="typeLabel" class="tip__type">{{ typeLabel }}</p>
        </header>

        <section v-if="shownHeadline" class="tip__headline">
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

        <p
          v-if="view.use?.kind === 'locked'"
          class="tip__will-note"
          data-testid="item-tooltip-will-locked"
        >
          {{ t('itemTooltip.willLocked') }}
        </p>

        <ul v-if="view.shields > 0 || bonusHearts > 0" class="tip__bonuses">
          <li v-if="view.shields > 0" class="tip__bonus" data-testid="item-tooltip-shields">
            <img class="tip__bonus-icon" :src="SHIELD_ICON_URL" alt="" />
            {{ t('itemTooltip.shields', { count: view.shields }) }}
          </li>
          <li v-if="bonusHearts > 0" class="tip__bonus" data-testid="item-tooltip-hearts">
            <img class="tip__bonus-icon" :src="HEART_ICON_URL" alt="" />
            {{ t('itemTooltip.hearts', { count: bonusHearts }) }}
          </li>
        </ul>

        <div
          v-if="tokenLines.length || attributeRows.length"
          class="tip__lines"
          data-testid="item-tooltip-description"
        >
          <p
            v-for="(line, index) in tokenLines"
            :key="index"
            class="tip__line"
            data-testid="item-tooltip-line"
          >
            {{ line }}
          </p>
          <p
            v-for="row in attributeRows"
            :key="row.key"
            class="tip__line"
            data-testid="item-tooltip-attribute"
          >
            <span class="tip__stat">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path :d="ICON_PATHS[row.icon as TIconName]" />
              </svg>
              {{ row.label }} {{ row.value }}
            </span>
          </p>
        </div>
        <p v-else-if="!view.token && view.description" class="tip__flavor">
          {{ t(view.description) }}
        </p>

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
import type { InventoryTooltipView } from '@/composables/use-item-tooltip';
import { tokenDescription, tokenAttributeRows, tokenName } from '@/services/tokens/token-text';
import { strikeHeartsOf } from '@hexoflat/engine/tokens/tool-action';
import {
  EQUIP_SLOT_ICON,
  ICON_PATHS,
  ITEM_ICON_BY_KEY,
  type TIconName,
} from '@/components/gui/icons/item-icons';
import { SKILL_ICON } from '@/components/gui/icons/skill-presentation';
import { LIGHT_NAME_COLOR } from '@/render/light';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import {
  TOKEN_LINE_KEYS,
  tokenTypeTextKey,
} from '@hexoflat/engine/tokens/factory/description-builder';
import { useItemTooltipLabels } from './use-item-tooltip-labels';

const SHIELD_ICON_URL = '/board-assets/hero-board/shield-icon.png';
const HEART_ICON_URL = '/board-assets/hero-board/heart-icon.png';

const props = defineProps<{ view: InventoryTooltipView; square?: boolean }>();
const { t, locale } = useI18n();

const title = computed(() =>
  props.view.token ? tokenName(props.view.token, locale.value) : t(props.view.title),
);
const shownHeadline = computed(() => {
  const headline = props.view.headline;
  if (headline?.kind !== 'multiplier') return headline;
  const strike = strikeHeartsOf(props.view.key);
  return strike === null ? undefined : { kind: 'damage' as const, min: strike, max: strike };
});
const tokenLines = computed(() => {
  const { token } = props.view;
  if (!token) return [];
  const hidden: string[] = [TOKEN_LINE_KEYS.kind, TOKEN_LINE_KEYS.tier];
  if (shownHeadline.value?.kind === 'damage') hidden.push(TOKEN_LINE_KEYS.strike);
  const description = token.description.filter((line) => !hidden.includes(line.key));
  return tokenDescription({ ...token, description }, locale.value);
});
const attributeRows = computed(() =>
  props.view.token ? tokenAttributeRows(props.view.token, locale.value) : [],
);
const labels = useItemTooltipLabels();

const lightColor = computed(() => LIGHT_NAME_COLOR[props.view.lightName]);
const tokenTypeLabel = computed(() => t(tokenTypeTextKey(props.view.tokenType.kind)));
const isGear = computed(
  () => props.view.group === EHexobjectGroup.TOOL || props.view.group === EHexobjectGroup.EQUIPMENT,
);
const typeLabel = computed(() => (isGear.value ? null : labels.value.group[props.view.group]));
const bonusHearts = computed(() => (props.view.token ? 0 : props.view.hearts));
const iconName = computed<TIconName>(
  () =>
    ITEM_ICON_BY_KEY[props.view.key] ??
    (props.view.equipSlot ? EQUIP_SLOT_ICON[props.view.equipSlot] : 'chest'),
);

const headlineLabel = computed(() =>
  shownHeadline.value ? labels.value.headline[shownHeadline.value.kind] : '',
);
const headlineValue = computed(() => {
  const headline = shownHeadline.value;
  if (!headline) return '';
  return headline.min === headline.max ? `${headline.max}` : `${headline.min}–${headline.max}`;
});
const useSkillId = computed(() => props.view.use?.skillId ?? null);
const useIcon = computed(() =>
  useSkillId.value ? ICON_PATHS[SKILL_ICON[useSkillId.value]] : null,
);
const comparison = computed(() => {
  const headline = props.view.headline;
  const result = headline?.kind === 'multiplier' ? undefined : headline?.comparison;
  if (!result || result.direction === 'same') return null;
  const better = result.direction === 'better';
  return {
    direction: result.direction,
    icon: better ? ICON_PATHS.better : ICON_PATHS.worse,
    text: `${better ? '+' : '−'}${Math.abs(result.delta)}`,
  };
});

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
  background: color-mix(in srgb, var(--light) 60%, #000);
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
      color-mix(in srgb, var(--light) 12%, transparent),
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
.tip__token-type-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}
.tip__token-type {
  color: var(--light);
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
.tip__lines {
  margin: 10px 0 0;
}

.tip__line {
  margin: 0;
  color: var(--flavor);
  font-size: 0.9rem;
  line-height: 1.35;
  text-align: center;
}

.tip__title {
  margin: 0;
  color: var(--light);
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
  color: var(--light);
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
  background: var(--light);
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
}
.tip__medal-core {
  position: absolute;
  inset: 3px;
  display: grid;
  place-items: center;
  background: #0f0d0a;
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  color: var(--light);
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
