import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { i18n } from '@/i18n';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import SettingsOverlay from './settings-overlay.vue';

let app: App;
let host: HTMLElement;

const button = () =>
  host.querySelector<HTMLButtonElement>('[data-testid="settings-dev-add-coins-button"]')!;

describe('settings overlay: dev coins', () => {
  beforeEach(async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    localStorage.clear();
    useHeroInventoryStore().hydrate();
    useHeroToolStore().clearActionMessage();
    host = document.createElement('div');
    document.body.appendChild(host);
    app = createApp(SettingsOverlay).use(pinia).use(i18n);
    app.mount(host);
    await nextTick();
  });
  afterEach(() => {
    app.unmount();
    host.remove();
  });

  it('has a button that says what it does', () => {
    expect(button().textContent).toContain('500');
  });

  it('adds 500 coins on every click, into one stack', () => {
    const inventory = useHeroInventoryStore();
    button().click();
    expect(inventory.countItem(K.COINS)).toBe(500);
    button().click();
    expect(inventory.countItem(K.COINS)).toBe(1000);
    expect(inventory.items.filter((item) => item.key === K.COINS)).toHaveLength(1);
  });

  it('says so instead of adding coins the bag cannot carry', () => {
    const inventory = useHeroInventoryStore();
    inventory.carryCapacityKg = inventory.carriedWeightKg;
    button().click();
    expect(inventory.countItem(K.COINS)).toBe(0);
    expect(useHeroToolStore().actionMessage).toBeTruthy();
  });
});
