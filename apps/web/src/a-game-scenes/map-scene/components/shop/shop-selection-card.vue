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
        <div class="art">
          <div class="icon" :style="iconStyle" aria-hidden="true"></div>
        </div>
        <div class="info">
          <div class="text">
            <h4 data-testid="shop-card-name">{{ view.name }}</h4>
            <p class="meta" data-testid="shop-card-meta">{{ meta }}</p>
            <p class="note" :class="{ 'is-reason': !!reason }">
              <span v-if="reason" data-testid="shop-card-reason" :data-reason="view.block">{{
                reason
              }}</span>
              <span v-else-if="note" data-testid="shop-card-note">{{ note }}</span>
            </p>
          </div>
          <label v-if="view.discountPercent !== null" class="guess">
            <span>{{ t('shop.card.yourPrice') }}</span>
            <input
              v-model="shopGuess"
              type="text"
              inputmode="numeric"
              maxlength="3"
              data-testid="shop-card-price-input"
              :placeholder="t('shop.card.pricePlaceholder')"
              :aria-label="t('shop.card.yourPrice')"
              @keydown.enter.prevent="onAction"
            />
          </label>
          <div v-else-if="view.maxQty > 1 || qty > 1" class="qty">
            <div class="stepper">
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
            </div>
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
        </div>
        <div class="controls">
          <span v-if="view.mode === 'trading'" class="pays" data-testid="shop-card-trade-price">
            {{ t('shop.card.priceLabel') }}
            <img :src="COIN_SRC" alt="" aria-hidden="true" />
            <b :data-price="view.preview.price ?? undefined">{{ view.preview.price ?? 0 }}</b>
          </span>
          <button
            type="button"
            class="action"
            :class="{ 'is-trade': view.mode === 'trading' }"
            data-testid="shop-card-action"
            :disabled="actionDisabled"
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
import {
  clearShopSelection,
  shopGuess,
  shopQty,
  shopSelection,
} from '@/composables/shop-selection';
import { useShopCard } from '@/composables/use-shop-card';
import { parseGuess, submitDeal } from '@/composables/use-shop-deal';
import { quickTrade } from '@/composables/use-shop-drag';

const COIN_SRC = getPrototype(HEXOBJECT_KEYS.COINS).spritePath ?? '';

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
  return '';
});

const actionDisabled = computed(() => {
  const current = view.value;
  if (!current) return true;
  if (current.discountPercent !== null) return parseGuess(shopGuess.value) === null;
  return !current.preview.ok;
});

function onAction(): void {
  const current = view.value;
  if (!current) return;
  if (current.discountPercent !== null) {
    const guess = parseGuess(shopGuess.value);
    if (guess !== null && current.source.kind === 'trade') {
      void submitDeal(current.source.index, current.key, guess);
    }
    return;
  }
  if (!current.preview.ok) return;
  void quickTrade(current.source, false, qty.value);
}
</script>

<style scoped>
.card {
  flex: none;
  box-sizing: border-box;
  height: 108px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0 var(--stash-pad);
  padding: 6px;
  border: 1px solid rgba(227, 194, 122, 0.4);
  border-radius: 8px;
  background:
    repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.12) 0 2px, transparent 2px 9px),
    linear-gradient(180deg, #2e1d12, #170d06);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.6),
    inset 0 1px 0 rgba(255, 214, 160, 0.1),
    inset 0 -8px 14px rgba(0, 0, 0, 0.25);
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
  gap: 6px;
}
.art {
  flex: none;
  width: 76px;
  display: grid;
  place-items: center;
}
.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 4px;
  padding: 2px 4px;
}
.icon {
  width: 64px;
  height: 64px;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
  filter: drop-shadow(0 6px 8px rgba(0, 0, 0, 0.55));
}
.text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
}
h4 {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  font-family: var(--font-main, serif), serif;
  font-size: 19px;
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
  font-size: 13px;
}
.pays {
  flex: none;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
  border: 1px solid rgba(227, 194, 122, 0.45);
  border-radius: 5px;
  background: rgba(20, 10, 4, 0.55);
  color: rgba(255, 240, 220, 0.75);
  font-size: 12px;
  line-height: 22px;
}
.pays img {
  width: 13px;
  height: 13px;
  object-fit: contain;
}
.pays b {
  color: #f0d48a;
  font-family: var(--font-main, serif), serif;
  font-size: 16px;
}

.note {
  margin: 0;
  color: rgba(255, 255, 255, 0.55);
  font-size: 13px;
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
  padding: 6px;
}
.guess {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
}
.guess input {
  box-sizing: border-box;
  width: 64px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid #e3c27a;
  border-radius: 8px;
  background: rgba(10, 5, 2, 0.55);
  color: #f0e4c4;
  font-size: 15px;
  font-weight: 700;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.qty {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
}
.stepper {
  display: inline-flex;
  align-items: stretch;
  height: 30px;
  border: 1px solid rgba(227, 194, 122, 0.5);
  border-radius: 15px;
  background: rgba(10, 5, 2, 0.55);
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.4);
  overflow: hidden;
}
.stepper button {
  width: 32px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: #f0d48a;
  font-size: 19px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: background 0.1s ease;
}
.stepper button:not(:disabled):hover {
  background: rgba(227, 194, 122, 0.18);
}
.stepper button:not(:disabled):active {
  background: rgba(227, 194, 122, 0.3);
}
.stepper button:disabled {
  opacity: 0.35;
  cursor: default;
}
.stepper span {
  min-width: 36px;
  display: grid;
  place-items: center;
  border-left: 1px solid rgba(227, 194, 122, 0.25);
  border-right: 1px solid rgba(227, 194, 122, 0.25);
  color: #f0e4c4;
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.qty .max {
  height: 30px;
  padding: 0 11px;
  border: 1px solid rgba(227, 194, 122, 0.5);
  border-radius: 15px;
  background: transparent;
  box-shadow: none;
  color: #f0d48a;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}
.qty .max:not(:disabled):hover {
  background: rgba(227, 194, 122, 0.18);
}
.qty .max:disabled {
  opacity: 0.35;
  cursor: default;
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
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
}
.action.is-trade {
  border: 2px solid #d9985a;
  background: linear-gradient(180deg, rgba(217, 152, 90, 0.28), rgba(120, 66, 30, 0.35));
  box-shadow:
    inset 0 1px 0 rgba(255, 220, 180, 0.25),
    0 0 10px rgba(217, 152, 90, 0.25);
  color: #ffe2bd;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
}
.action.is-trade:not(:disabled):hover {
  border-color: #f0b476;
  background: linear-gradient(180deg, rgba(240, 180, 118, 0.38), rgba(140, 78, 36, 0.45));
}
.action.is-trade:not(:disabled):active {
  transform: translateY(1px);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.5);
}
.action:disabled {
  opacity: 0.45;
  cursor: default;
}
</style>
