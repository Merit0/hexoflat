<template>
  <div v-if="shopToast.current" class="toast" role="status" data-testid="shop-toast">
    <span data-testid="shop-toast-text">{{ shopToast.current.text }}</span>
    <button
      v-if="shopToast.current.undo"
      type="button"
      data-testid="shop-toast-undo"
      @click="onUndo"
    >
      {{ t('shop.toast.undo') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { clearShopToast, shopToast } from '@/composables/shop-toast';

const { t } = useI18n();

function onUndo(): void {
  const undo = shopToast.current?.undo;
  clearShopToast();
  undo?.();
}
</script>

<style scoped>
.toast {
  position: absolute;
  left: var(--stash-pad);
  right: var(--stash-pad);
  bottom: 8px;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid #3a4450;
  border-radius: 10px;
  background: #171c22;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.55);
  color: #e8e2d2;
  font-size: 13px;
}
.toast button {
  height: 32px;
  padding: 0 12px;
  border: 1px solid #7fb4e8;
  border-radius: 8px;
  background: transparent;
  color: #cfe4f8;
  font-weight: 700;
  cursor: pointer;
}
</style>
