<template>
  <div class="shop" data-testid="stash-shop">
    <img
      class="chest"
      :class="{ 'is-locked': !isNext }"
      :src="CHEST_IMAGE"
      alt=""
      aria-hidden="true"
    />
    <div
      v-if="isNext && price !== null"
      class="price"
      tabindex="0"
      :aria-label="t('stash.pay.hint')"
      data-testid="stash-price"
      @mouseenter="showHint"
      @focus="showHint"
    >
      <span class="cost">{{ price }}</span>
      <img class="coin" :src="coinIcon" alt="" aria-hidden="true" />
    </div>
    <svg
      v-else
      class="lock"
      viewBox="0 0 24 24"
      role="img"
      :aria-label="t('stash.buy.after', { prev: stash.chests + 1 })"
      data-testid="stash-buy-after"
    >
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { stashChestPrice } from '@hexoflat/engine/inventory/stash-constants';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { resolveInventoryView } from '@hexoflat/engine/utils/inventory/traits-resolver';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';

const CHEST_IMAGE = '/hex-assets/hex-loot/stash-chest-token-image.png';
const coinIcon = resolveInventoryView(HEXOBJECT_KEYS.COINS).iconPath;

const { t } = useI18n();
const stash = useHeroStashStore();
const heroToolStore = useHeroToolStore();

const isNext = computed(() => stash.activeChest === stash.chests);
const price = computed(() => stashChestPrice(stash.chests));

function showHint() {
  heroToolStore.setActionMessage(t('stash.pay.hint'), null, null, 'info');
}
</script>

<style scoped>
.shop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: calc(6 * var(--stash-cell) + 5 * var(--stash-gap));
  border-radius: 5px;
  background: rgba(120, 160, 170, 0.12);
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.35);
  text-align: center;
}
.chest {
  width: clamp(56px, 9cqw, 96px);
  aspect-ratio: 1;
  object-fit: contain;
  opacity: 0.85;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.7));
}
.chest.is-locked {
  opacity: 0.4;
}
.lock {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: rgba(255, 255, 255, 0.55);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.price {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: 999px;
  border: 1px solid rgba(255, 220, 150, 0.55);
  background: linear-gradient(180deg, rgba(43, 46, 52, 0.95), rgba(18, 12, 8, 0.96));
  color: rgba(255, 236, 186, 0.95);
  cursor: help;
  outline: none;
}
.price:hover,
.price:focus-visible {
  border-color: rgba(255, 220, 150, 0.8);
}
.cost {
  font-size: 1rem;
  font-weight: 900;
}
.coin {
  width: 1.5em;
  height: 1.5em;
  object-fit: contain;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.6));
}
</style>
