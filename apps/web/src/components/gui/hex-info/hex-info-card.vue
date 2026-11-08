<template>
  <div class="card">
    <header class="card__head">
      <div class="card__titles">
        <h4 class="card__title" data-testid="hex-info-title">{{ view.title }}</h4>
        <span class="card__kind" data-testid="hex-info-kind">{{ view.kind }}</span>
        <span v-if="view.subtitle" class="card__subtitle">{{ view.subtitle }}</span>
      </div>
    </header>

    <div
      class="card__divider"
      :style="{ '--gem': view.rarity?.color ?? '#d9a553' }"
      :data-rarity-tone="view.rarity?.tone ?? 'none'"
      data-testid="hex-info-divider"
      aria-hidden="true"
    >
      <span />
    </div>

    <p v-if="view.description" class="card__flavor">{{ view.description }}</p>

    <section v-if="hasReadout" class="card__readout" data-testid="hex-info-readout">
      <hex-info-hearts v-if="view.hearts" :hearts="view.hearts" large />

      <div v-else-if="view.effect" class="card__effect" data-testid="hex-info-effect">
        <strong class="card__effect-label">{{ view.effect.label }}</strong>
      </div>

      <div v-else-if="view.supply" class="card__supply" data-testid="hex-info-supply">
        <div class="card__pips">
          <span
            v-for="index in pipCount"
            :key="index"
            class="card__pip"
            :class="{ 'is-on': index <= litPips }"
          />
        </div>
        <span class="card__supply-text">
          {{ view.supply.label }}
          <strong>{{ view.supply.value }} / {{ view.supply.max }}</strong>
        </span>
      </div>

      <div
        v-else
        class="card__seal"
        :class="sealClass"
        :data-state="sealState"
        data-testid="hex-info-seal"
      >
        <svg v-if="view.broken" viewBox="0 0 24 24" aria-hidden="true">
          <path :d="ICON_PATHS.victory" />
        </svg>
        <svg v-else-if="view.locked" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="11" width="14" height="9" rx="1.5" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true">
          <path :d="ICON_PATHS.hand" />
        </svg>
        {{ sealLabel }}
      </div>
    </section>

    <ul v-if="rows.length" class="card__stats">
      <li v-for="row in rows" :key="row.id" class="card__stat">
        <svg class="card__stat-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path :d="ICON_PATHS[row.icon]" />
        </svg>
        <span class="card__stat-label">{{ row.label }}</span>
        <strong
          class="card__stat-value"
          :class="{ 'is-gain': row.value.startsWith('+') || row.id === 'headline' }"
          :data-testid="row.id === 'headline' ? 'hex-info-headline' : undefined"
          >{{ row.value }}</strong
        >
      </li>
    </ul>

    <hex-info-tags :tags="view.tags" center />

    <hex-info-actions :actions="view.actions" class="card__actions" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ICON_PATHS, type TIconName } from '@/components/gui/icons/item-icons';
import type { HexInfoView } from '@/services/hex-info/build-hex-info';
import HexInfoActions from './hex-info-actions.vue';
import HexInfoHearts from './hex-info-hearts.vue';
import HexInfoTags from './hex-info-tags.vue';

const MAX_PIPS = 12;

const ICON_BY_STAT: Record<string, TIconName> = {
  attack: 'sword',
  squad: 'skull',
  damage: 'sword',
  radius: 'target',
  defense: 'shield',
  shields: 'shield',
  hearts: 'heart',
  durability: 'durability',
  weight: 'weight',
  amount: 'stack',
  stash: 'chest',
  loot: 'chest',
};

const props = defineProps<{ view: HexInfoView }>();
const { t } = useI18n();

const hasReadout = computed(
  () =>
    !!props.view.hearts ||
    !!props.view.supply ||
    !!props.view.effect ||
    props.view.variant === 'construction',
);

const sealState = computed(() => {
  if (props.view.broken) return 'broken';
  return props.view.locked ? 'locked' : 'interactable';
});

const sealClass = computed(() => {
  if (props.view.broken) return 'is-broken';
  return props.view.locked ? 'is-locked' : 'is-open';
});

const sealLabel = computed(() => {
  if (props.view.broken) return t('hexInfo.tags.broken');
  return props.view.locked ? t('hexInfo.tags.locked') : t('hexInfo.tags.interactable');
});

const pipCount = computed(() => Math.min(props.view.supply?.max ?? 0, MAX_PIPS));
const litPips = computed(() => {
  const supply = props.view.supply;
  if (!supply || supply.max <= 0) return 0;
  return Math.ceil((supply.value / supply.max) * pipCount.value);
});

const rows = computed(() => {
  const headline = props.view.headline;
  const entries = headline
    ? [{ id: 'headline', label: headline.label, value: headline.value }, ...props.view.stats]
    : props.view.stats;
  return entries.map((entry) => ({
    ...entry,
    icon: ICON_BY_STAT[entry.id === 'headline' ? 'attack' : entry.id] ?? 'star',
  }));
});
</script>

<style scoped>
.card {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.card__head {
  display: flex;
  justify-content: center;
}
.card__titles {
  display: grid;
  flex: 1;
  min-width: 0;
  justify-items: center;
  gap: 6px;
}
.card__title {
  margin: 0;
  color: #f1d9a4;
  font-family: 'Alegreya SC', var(--font-main, serif), serif;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.05;
  text-align: center;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
  overflow-wrap: anywhere;
}
.card__kind {
  padding: 2px 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 55%, #5a4a30);
  background: rgba(255, 255, 255, 0.03);
  clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 8px 100%, 0 50%);
  color: #e6d3a8;
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
}
.card__subtitle {
  color: var(--muted);
  font-size: 0.8rem;
  text-align: center;
}
.card__divider {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 8px;
  background: linear-gradient(90deg, transparent, #b98a43 20%, #b98a43 80%, transparent) center /
    100% 1px no-repeat;
}
.card__divider span {
  width: 8px;
  height: 8px;
  background: var(--gem);
  box-shadow: 0 0 6px color-mix(in srgb, var(--gem) 60%, transparent);
  transform: rotate(45deg) scale(0.85);
}
.card__effect {
  display: flex;
  align-items: center;
  gap: 6px;
}
.card__effect-label {
  color: #ff8a7a;
  font-size: 1rem;
  font-weight: 700;
}
.card__flavor {
  margin: 0;
  color: #d8ccb2;
  font-size: 0.85rem;
  font-style: italic;
  line-height: 1.3;
  text-align: center;
  overflow-wrap: anywhere;
}
.card__readout {
  display: grid;
  justify-items: center;
  padding: 6px 8px;
  border: 1px solid rgba(185, 138, 67, 0.4);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
}
.card__supply {
  display: grid;
  justify-items: center;
  gap: 5px;
}
.card__pips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
}
.card__pip {
  width: 14px;
  height: 16px;
  background: #2a241c;
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
}
.card__pip.is-on {
  background: var(--accent);
}
.card__supply-text {
  color: var(--muted);
  font-size: 0.74rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.card__supply-text strong {
  margin-left: 6px;
  color: var(--ink);
  font-size: 0.95rem;
  letter-spacing: 0;
}
.card__seal {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.card__seal svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.card__seal.is-locked {
  color: #e8b865;
}
.card__seal.is-broken {
  color: #e0705c;
}
.card__seal.is-open {
  color: #7bd88f;
}
.card__stats {
  display: grid;
  margin: 0;
  padding: 2px 0;
  list-style: none;
  border: 1px solid rgba(185, 138, 67, 0.45);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
}
.card__stat {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
}
.card__stat + .card__stat {
  border-top: 1px solid rgba(185, 138, 67, 0.25);
}
.card__stat-icon {
  flex: none;
  width: 18px;
  height: 18px;
  fill: none;
  stroke: #cdbf9f;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.card__stat-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: #e3dccb;
  font-size: 0.9rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card__stat-value {
  color: #f4efe2;
  font-size: 1.1rem;
  font-weight: 800;
}
.card__stat-value.is-gain {
  color: #5fe04e;
}
.card .card__actions {
  margin: 0;
  justify-self: stretch;
}
</style>
