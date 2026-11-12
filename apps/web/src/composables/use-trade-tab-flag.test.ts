import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useUiSettingsStore } from '@/stores/ui-settings-store';
import { shopTab } from './shop-tab';
import { leaveLockedTradeTab, useTradeTabEnabled } from './use-trade-tab-flag';

describe('the Trade tab feature flag', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    shopTab.value = 'goods';
  });

  it('is off by default, so the tab stays locked', () => {
    expect(useTradeTabEnabled().value).toBe(false);
  });

  it('turns on from the dev setting and survives a reload', () => {
    useUiSettingsStore().setTradeTabEnabled(true);
    expect(useTradeTabEnabled().value).toBe(true);

    setActivePinia(createPinia());
    useUiSettingsStore().hydrateFromStorage();
    expect(useTradeTabEnabled().value).toBe(true);
  });

  it('sends the board back to Goods when the tab gets locked while open', () => {
    shopTab.value = 'trade';
    leaveLockedTradeTab(true);
    expect(shopTab.value).toBe('trade');

    leaveLockedTradeTab(false);
    expect(shopTab.value).toBe('goods');
  });
});
