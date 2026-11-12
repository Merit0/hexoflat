import { reactive } from 'vue';

export const SHOP_TOAST_MS = 5000;

export interface ShopToast {
  text: string;
  undo: (() => void) | null;
}

export const shopToast = reactive<{ current: ShopToast | null }>({ current: null });

let timer: ReturnType<typeof setTimeout> | null = null;

export function clearShopToast(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  shopToast.current = null;
}

export function showShopToast(text: string, undo: (() => void) | null = null): void {
  clearShopToast();
  shopToast.current = { text, undo };
  timer = setTimeout(clearShopToast, SHOP_TOAST_MS);
}
