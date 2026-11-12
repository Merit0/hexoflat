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
          <div v-else-if="view.mode === 'listed'" class="guess">
            <input
              v-model="shopListPrice"
              type="text"
              inputmode="numeric"
              maxlength="3"
              data-testid="shop-card-price-input"
              :placeholder="t('shop.card.pricePlaceholder')"
              :aria-label="t('shop.card.yourPrice')"
              @keydown.enter.prevent="onReprice"
            />
            <button
              type="button"
              class="action is-secondary"
              data-testid="shop-card-reprice"
              :disabled="!repriceReady"
              @click="onReprice"
            >
              {{ t('shop.card.setPrice') }}
            </button>
          </div>
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
          <label v-if="view.mode === 'listing'" class="guess is-listing">
            <span>{{ t('shop.card.yourPrice') }}</span>
            <input
              v-model="shopListPrice"
              type="text"
              inputmode="numeric"
              maxlength="3"
              data-testid="shop-card-price-input"
              :placeholder="t('shop.card.pricePlaceholder')"
              :aria-label="t('shop.card.yourPrice')"
              @keydown.enter.prevent="onEnter"
            />
          </label>
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
  shopListPrice,
  shopQty,
  shopSelection,
} from '@/composables/shop-selection';
import { parseListPrice, useShopCard } from '@/composables/use-shop-card';
import { submitList, submitReprice, submitUnlist } from '@/composables/use-shop-listing';
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
  if (view.value.mode === 'listed') return weight;
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
  if (view.value?.mode === 'listing') return t('shop.card.list');
  if (view.value?.mode === 'listed') return t('shop.card.takeBack');
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
    case 'SLOTS_FULL':
      return t('shop.block.TRADE_SLOTS_FULL');
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

const repriceReady = computed(() => {
  const current = view.value;
  if (!current || current.mode !== 'listed') return false;
  const price = parseListPrice(shopListPrice.value);
  return price !== null && price !== current.ownUnitPrice;
});

const actionDisabled = computed(() => {
  const current = view.value;
  if (!current) return true;
  if (current.mode === 'listing') return current.listPrice === null || !current.preview.ok;
  if (current.mode === 'listed') return !current.preview.ok;
  if (current.discountPercent !== null) return parseGuess(shopGuess.value) === null;
  return !current.preview.ok;
});

function onReprice(): void {
  const current = view.value;
  const price = parseListPrice(shopListPrice.value);
  if (!current || current.ownSlot === null || price === null || !repriceReady.value) return;
  void submitReprice(current.ownSlot, current.key, price);
}

function onEnter(): void {
  if (view.value?.mode === 'listed') onReprice();
  else onAction();
}

function onAction(): void {
  const current = view.value;
  if (!current) return;
  if (current.mode === 'listing' && current.source.kind === 'bag') {
    if (current.listPrice !== null && current.preview.ok) {
      void submitList(current.source.index, current.key, qty.value, current.listPrice);
    }
    return;
  }
  if (current.mode === 'listed' && current.ownSlot !== null) {
    void submitUnlist(current.ownSlot, current.key);
    return;
  }
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

<style scoped src="./shop-selection-card.css"></style>
