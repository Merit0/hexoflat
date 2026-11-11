<template>
  <span class="wrap">
    <button
      ref="button"
      type="button"
      class="refresh"
      :class="{ 'is-short': !affordable, 'is-confirm': refreshConfirming }"
      :data-affordable="affordable"
      :data-confirm="refreshConfirming"
      :disabled="refreshSending"
      data-testid="shop-refresh"
      @click="onClick"
    >
      {{ t('shop.refresh') }}
    </button>
    <span
      class="tip"
      :class="{ 'is-short': !affordable }"
      role="tooltip"
      data-testid="shop-refresh-price"
      :data-price="price"
    >
      <img :src="WILL_ICON" alt="" aria-hidden="true" />
      {{ price }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { clickRefresh, refreshConfirming, refreshSending } from '@/composables/use-shop-refresh';

const WILL_ICON = '/board-assets/will-icon-image.png';

const props = defineProps<{ price: number; affordable: boolean; losesBuyback: boolean }>();
const { t } = useI18n();
const button = ref<HTMLElement | null>(null);

function onClick() {
  if (!button.value) return;
  const refresh = { price: props.price, affordable: props.affordable };
  void clickRefresh(refresh, props.losesBuyback, button.value);
}
</script>

<style scoped>
.wrap {
  position: relative;
  display: inline-flex;
}
.refresh {
  --face: linear-gradient(180deg, #3d4d5c, #2a3744);
  --edge: linear-gradient(180deg, #7a8da0, #1b2630 60%, #46586a);
  position: relative;
  isolation: isolate;
  min-width: 0;
  height: 32px;
  padding: 0 16px;
  color: #f3e8d2;
  font-family: var(--font-main, serif), serif;
  font-size: 0.9rem;
  font-weight: 700;
  font-variant: small-caps;
  letter-spacing: 0.04em;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  border: 0;
  transition: transform 0.06s ease;
  background: var(--edge);
  clip-path: polygon(
    9px 0,
    calc(100% - 9px) 0,
    100% 9px,
    100% calc(100% - 9px),
    calc(100% - 9px) 100%,
    9px 100%,
    0 calc(100% - 9px),
    0 9px
  );
}
.refresh::before {
  content: '';
  position: absolute;
  inset: 2px;
  z-index: -1;
  background: var(--face);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
  clip-path: polygon(
    7px 0,
    calc(100% - 7px) 0,
    100% 7px,
    100% calc(100% - 7px),
    calc(100% - 7px) 100%,
    7px 100%,
    0 calc(100% - 7px),
    0 7px
  );
}
.refresh:not(:disabled):hover {
  --face: linear-gradient(180deg, #4a5d6e, #34444f);
}
.refresh:not(:disabled):active {
  --face: linear-gradient(180deg, #1f2a34, #2a3744);
  transform: translateY(1px) scale(0.97);
}
.refresh:focus-visible {
  outline: 3px solid #f5c26b;
  outline-offset: 3px;
}
.refresh.is-confirm {
  --edge: linear-gradient(180deg, #f5c26b, #8a6a2a 60%, #c99a45);
}
.refresh:disabled {
  opacity: 0.6;
}
.tip {
  position: absolute;
  bottom: calc(100% + 5px);
  right: 0;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 7px;
  border: 1px solid #7a8da0;
  border-radius: 4px;
  background: #1f2a34;
  box-shadow: 0 -4px 10px rgba(0, 0, 0, 0.45);
  color: #ffe98a;
  font-size: 0.8rem;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
  pointer-events: none;
  visibility: hidden;
}
.tip img {
  width: 14px;
  height: 14px;
  object-fit: contain;
}
.tip.is-short {
  color: #ff9d9d;
}
.refresh:hover + .tip,
.refresh:focus-visible + .tip {
  visibility: visible;
}
</style>
