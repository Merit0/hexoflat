<template>
  <board-refresh-button
    testid="shop-refresh"
    :label="t('shop.refresh.aria')"
    :price="price"
    :affordable="affordable"
    :disabled="sending || !enabled"
    @refresh="onRefresh"
  />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import BoardRefreshButton from '@/components/gui/board/board-refresh-button.vue';
import { refreshSending as sending, refreshShop } from '@/composables/use-shop-refresh';
import type { RefreshPreview } from '@/services/trade/trade-preview';

const props = defineProps<{ price: number; affordable: boolean; enabled: boolean }>();
const { t } = useI18n();

function onRefresh(): void {
  const refresh: RefreshPreview = { price: props.price, affordable: props.affordable };
  void refreshShop(refresh);
}
</script>
