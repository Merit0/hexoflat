<template>
  <section
    class="card"
    :class="{ 'is-empty': !view }"
    data-testid="shop-card"
    :data-mode="view?.mode"
    :data-item-key="view?.key"
  >
    <template v-if="view">
      <div class="body">
        <div class="info">
          <div class="top">
            <div class="icon" :style="iconStyle" aria-hidden="true"></div>
            <div class="text">
              <div class="line">
                <h4 data-testid="shop-card-name">{{ view.name }}</h4>
                <span
                  v-if="view.mode === 'trading'"
                  class="pays"
                  data-testid="shop-card-trade-price"
                >
                  {{ t('shop.card.paysLabel') }}
                  <img :src="COIN_SRC" alt="" aria-hidden="true" />
                  <b :data-price="view.preview.price ?? undefined">{{ view.preview.price ?? 0 }}</b>
                </span>
              </div>
              <p class="meta" data-testid="shop-card-meta">{{ meta }}</p>
            </div>
          </div>
          <p class="note" :class="{ 'is-reason': !!reason }">
            <span v-if="reason" data-testid="shop-card-reason" :data-reason="view.block">{{
              reason
            }}</span>
            <span v-else data-testid="shop-card-note">{{ note }}</span>
          </p>
        </div>
        <div class="controls">
          <div v-if="view.maxQty > 1 || qty > 1" class="qty">
            <button
              type="button"
              data-testid="shop-qty-dec"
              :disabled="qty <= 1"
              :aria-label="t('shop.card.dec')"
              @click="shopQty = qty - 1"
            >
              −
            </button>
            <span data-testid="shop-qty-value" :data-qty="qty">{{ qty }}</span>
            <button
              type="button"
              data-testid="shop-qty-inc"
              :disabled="qty >= view.maxQty"
              :aria-label="t('shop.card.inc')"
              @click="shopQty = qty + 1"
            >
              +
            </button>
            <button
              type="button"
              class="max"
              data-testid="shop-qty-max"
              :disabled="qty >= view.maxQty"
              @click="shopQty = view.maxQty"
            >
              {{ view.mode === 'trading' ? t('shop.card.all') : t('shop.card.max') }}
            </button>
          </div>
          <button
            type="button"
            class="action"
            :class="{ 'is-trade': view.mode === 'trading' }"
            data-testid="shop-card-action"
            :disabled="!view.preview.ok"
            @click="onAction"
          >
            {{ actionLabel }}
          </button>
        </div>
      </div>
    </template>
    <template v-else>
      <h4 class="pick">{{ t('shop.card.empty.title') }}</h4>
      <p class="note">{{ t('shop.card.empty.hint') }}</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { getPrototype } from '@hexoflat/engine';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { resolveInventoryView } from '@hexoflat/engine/utils/inventory/traits-resolver';
import { clearShopSelection, shopQty, shopSelection } from '@/composables/shop-selection';
import { useShopCard } from '@/composables/use-shop-card';
import { quickTrade } from '@/composables/use-shop-drag';

const COIN_SRC = getPrototype(HEXOBJECT_KEYS.COINS).spritePath ?? '';

const props = defineProps<{ sellRatePercent: number }>();
const { t } = useI18n();
const view = useShopCard();

watch(
  () => shopSelection.list !== null && view.value === null,
  (stale) => {
    if (stale) clearShopSelection();
  },
);

const qty = computed(() =>
  view.value ? Math.min(Math.max(shopQty.value, 1), view.value.maxQty) : 1,
);
const iconStyle = computed(() => {
  const path = view.value ? resolveInventoryView(view.value.key).iconPath : '';
  return { backgroundImage: path ? `url("${path}")` : 'none' };
});

const meta = computed(() => {
  if (!view.value) return '';
  const weight = `${Math.round(view.value.unitWeightKg * 100) / 100} kg`;
  const inBag =
    view.value.inBag > 0 ? t('shop.card.inBag', { n: view.value.inBag }) : t('shop.card.notInBag');
  return `${weight} · ${inBag}`;
});

const actionLabel = computed(() => {
  if (view.value?.mode === 'buying') return t('shop.card.buy');
  if (view.value?.mode === 'buyback') {
    const price = view.value.preview.price ?? 0;
    return t('shop.card.buyBack', { price });
  }
  return t('shop.card.trade');
});

const reason = computed(() => {
  switch (view.value?.block) {
    case 'OVERWEIGHT':
      return t('shop.block.OVERWEIGHT');
    case 'BAG_FULL':
      return t('shop.block.BAG_FULL');
    case 'NOT_SELLABLE':
      return t('shop.block.NOT_SELLABLE');
    default:
      return '';
  }
});

const note = computed(() => {
  const current = view.value;
  if (!current) return '';
  if (current.mode === 'buying') {
    return current.available > 1
      ? t('shop.card.note.inStock', { n: current.available })
      : t('shop.card.note.lastOne');
  }
  if (current.mode === 'buyback') return t('shop.card.note.samePrice');
  return t('shop.card.note.tradeRate', { percent: props.sellRatePercent });
});

function onAction(): void {
  const current = view.value;
  if (!current || !current.preview.ok) return;
  void quickTrade(current.source, false, qty.value);
}
</script>

<style scoped>
.card {
  flex: none;
  box-sizing: border-box;
  height: 100px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0 var(--stash-pad);
  padding: 8px 10px;
  border: 1px solid rgba(227, 194, 122, 0.3);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(34, 44, 54, 0.9), rgba(14, 18, 24, 0.9));
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  overflow: hidden;
}
.card.is-empty {
  justify-content: center;
  align-items: center;
  text-align: center;
}
.pick {
  margin: 0;
  font-family: var(--font-main, serif), serif;
  font-size: 1rem;
  color: rgba(255, 236, 186, 0.95);
}
.body {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
  gap: 10px;
}
.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}
.top {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 10px;
}
.icon {
  flex: none;
  width: 44px;
  height: 44px;
  align-self: center;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.55));
}
.text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
}
.line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
h4 {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  font-family: var(--font-main, serif), serif;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.15;
  color: #f0e4c4;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}
.meta {
  margin: 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
}
.pays {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
  border: 1px solid rgba(227, 194, 122, 0.45);
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.35);
  color: rgba(255, 255, 255, 0.7);
  font-size: 10px;
  line-height: 18px;
}
.pays img {
  width: 11px;
  height: 11px;
  object-fit: contain;
}
.pays b {
  color: #f0d48a;
  font-family: var(--font-main, serif), serif;
  font-size: 13px;
}
.note {
  margin: 0;
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
  line-height: 1.2;
}
.note.is-reason {
  color: #ee9a9a;
}
.controls {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 5px;
}
.qty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
}
.qty button {
  min-width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.35);
  color: #f3e8d2;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}
.qty button:disabled {
  opacity: 0.4;
  cursor: default;
}
.qty span {
  min-width: 24px;
  text-align: center;
  color: #f0e4c4;
  font-size: 14px;
  font-weight: 700;
}
.qty .max {
  padding: 0 6px;
  font-size: 11px;
}
.action {
  min-width: 124px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid #f5c26b;
  border-radius: 8px;
  background: #e3c27a;
  color: #2a1d06;
  font-family: var(--font-main, serif), serif;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
.action.is-trade {
  border-color: #7fb4e8;
  background: transparent;
  color: #cfe4f8;
}
.action:disabled {
  opacity: 0.45;
  cursor: default;
}
</style>
