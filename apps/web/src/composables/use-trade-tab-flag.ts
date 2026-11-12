import { computed } from 'vue';
import { useUiSettingsStore } from '@/stores/ui-settings-store';
import { shopTab } from './shop-tab';

export function isTradeTabBuildEnabled(): boolean {
  return import.meta.env.VITE_SHOP_TRADE_TAB === 'true';
}

export function useTradeTabEnabled() {
  const settings = useUiSettingsStore();
  return computed(() => isTradeTabBuildEnabled() || settings.tradeTabEnabled);
}

export function leaveLockedTradeTab(enabled: boolean): void {
  if (!enabled && shopTab.value === 'trade') shopTab.value = 'goods';
}
