<template>
  <section
    v-if="cells.length > 0"
    class="uniques"
    data-testid="shop-unique-buyback"
    :data-count="cells.length"
    :aria-label="t('shop.uniqueBuyback.title')"
  >
    <h3>{{ t('shop.uniqueBuyback.title') }}</h3>
    <span class="note">{{ t('shop.uniqueBuyback.hint') }}</span>
    <ul class="list">
      <li
        v-for="(cell, index) in cells"
        :key="cell.instanceId"
        class="row"
        :data-testid="`shop-unique-buyback-${index}`"
        :data-instance-id="cell.instanceId"
      >
        <div class="cell" :data-rarity="cell.light" :data-item-key="cell.item.key">
          <stash-item-token
            :item="cell.item"
            standalone
            :rotation-deg="0"
            :price="() => tooltipPrice(cell)"
          />
        </div>
        <span class="name">{{ cell.name }}</span>
        <shop-price-tag
          :price="cell.price"
          :affordable="cell.affordable"
          :testid="`shop-unique-buyback-price-${index}`"
        />
        <button
          type="button"
          class="action"
          :data-testid="`shop-unique-buyback-action-${index}`"
          @click="buyBackUnique(cell.instanceId)"
        >
          {{ t('shop.uniqueBuyback.action') }}
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { getPrototype } from '@hexoflat/engine';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { planUniqueBuyback } from '@hexoflat/engine/trade/unique-buyback';
import type { TooltipPrice } from '@/composables/use-item-tooltip';
import { buyBackUnique } from '@/composables/use-shop-drag';
import { itemLightName } from '@/render/token-look';
import { currentInventory, heldUniques, traderRef } from '@/services/trade/trade-commands';
import { itemTitle } from '@/services/tokens/token-text';
import { useTraderStore } from '@/stores/trader-store';
import StashItemToken from '../stash/stash-item-token.vue';
import ShopPriceTag from './shop-price-tag.vue';

interface UniqueCell {
  instanceId: string;
  item: InventoryItem;
  name: string;
  light: string | undefined;
  price: number;
  affordable: boolean;
}

const { t, locale } = useI18n();
const traderStore = useTraderStore();

const cells = computed<UniqueCell[]>(() => {
  const trader = traderStore.traderKey ? traderRef(traderStore.traderKey) : null;
  if (!trader) return [];
  const inventory = currentInventory();
  const held = heldUniques(trader.key);
  return held.map(({ token, price, dayId }) => {
    const instanceId = token.instanceId ?? token.id;
    const key = token.type as THexobjectKey;
    const type = getPrototype(key).groupType;
    const id = `shop-unique-${instanceId}`;
    const item: InventoryItem = { id, key, type, amount: 1, token, slotKey: '', isNew: false };
    const plan = planUniqueBuyback(inventory, trader, held, instanceId, dayId);
    return {
      instanceId,
      item,
      name: itemTitle(item, locale.value),
      light: itemLightName(item) ?? undefined,
      price,
      affordable: plan.ok || plan.reason !== 'NOT_ENOUGH_COINS',
    };
  });
});

function tooltipPrice(cell: UniqueCell): TooltipPrice {
  return { kind: 'buyback', coins: cell.price, affordable: cell.affordable };
}
</script>

<style scoped src="../../../../components/gui/board/board-cell.css"></style>
<style scoped src="./shop-pane.css"></style>
<style scoped>
.uniques {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.list {
  display: flex;
  flex-direction: column;
  gap: var(--stash-gap);
  max-height: calc(3 * var(--stash-cell));
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}
.row {
  display: grid;
  grid-template-columns: var(--stash-cell) minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.name {
  overflow: hidden;
  color: rgba(255, 236, 186, 0.95);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.action {
  height: 30px;
  padding: 0 10px;
  border: 1px solid #f5c26b;
  border-radius: 8px;
  background: #e3c27a;
  color: #2a1d06;
  font-family: var(--font-main, serif), serif;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}
</style>
