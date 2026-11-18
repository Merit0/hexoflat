import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, nextTick, type App, type Component } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { ERarityKind } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { SPRITE_MANIFEST } from '@hexoflat/engine/tokens/sprite-manifest';
import type { ItemToken } from '@hexoflat/engine/tokens/token-schema';
import { i18n } from '@/i18n';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { baseTestToken, tokenItem, uniqueTestToken } from '@/test-support/token-fixtures';
import { tokenName } from '@/services/tokens/token-text';
import StashItemToken from '@/a-game-scenes/map-scene/components/stash/stash-item-token.vue';
import ShopTradeCell from '@/a-game-scenes/map-scene/components/shop/shop-trade-cell.vue';
import InventoryToken from './inventory-token.vue';
import EquipToken from './equip-token.vue';
import HeroEquipBoard from './hero-equip-board.vue';

let app: App | null = null;
let host: HTMLElement;

function spriteOf(token: ItemToken): string {
  return (
    SPRITE_MANIFEST.entries.find((entry) => entry.key === token.sprite)?.path ??
    SPRITE_MANIFEST.placeholder
  );
}

async function mount(component: Component, props: Record<string, unknown> = {}) {
  host = document.createElement('div');
  document.body.appendChild(host);
  app = createApp(component, props).use(i18n);
  app.use(createPinia());
  setActivePinia(createPinia());
  app.mount(host);
  await nextTick();
}

function background(selector: string): string {
  return host.querySelector<HTMLElement>(selector)?.style.backgroundImage ?? '';
}

const BASE = () => baseTestToken('sword', ERarityKind.GLOOM);
const UNIQUE = () => uniqueTestToken('lantern-eater');

const CASES = [
  { name: 'base', token: BASE, light: 'blue-light.png', tone: 'gloom' },
  { name: 'unique', token: UNIQUE, light: 'violet-light.png', tone: 'gloom-boss' },
] as const;

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  i18n.global.locale.value = 'en';
});

afterEach(() => {
  app?.unmount();
  host?.remove();
  app = null;
});

describe.each(CASES)('a $name token is drawn from its own data', ({ token, light, tone }) => {
  it('inventory token: sprite and light', async () => {
    const item = tokenItem(token(), 'r1c1');
    await mount(InventoryToken, { item });

    expect(background('.icon')).toContain(spriteOf(item.token!));
    expect(background('.rarity-glow')).toContain(light);
  });

  it('equipped hand token: sprite', async () => {
    const item = tokenItem(token(), 'eq:weapon');
    await mount(EquipToken, { item });

    expect(background('.icon')).toContain(spriteOf(item.token!));
    expect(background('.icon')).not.toContain('sword-hex.png');
  });

  it('hero equip board: light behind the weapon slot', async () => {
    const item = tokenItem(token(), 'eq:weapon');
    const pinia = createPinia();
    setActivePinia(pinia);
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    inventory.items = [...inventory.items.filter((entry) => entry.slotKey !== 'eq:weapon'), item];
    host = document.createElement('div');
    document.body.appendChild(host);
    app = createApp(HeroEquipBoard).use(pinia).use(i18n);
    app.mount(host);
    await nextTick();

    expect(background('[data-testid="equip-slot-weapon"]')).toContain(light);
  });

  it('stash and shop token: sprite and light', async () => {
    const item = tokenItem(token(), '');
    await mount(StashItemToken, { item, standalone: true, rotationDeg: 0 });

    expect(background('.icon')).toContain(spriteOf(item.token!));
    expect(background('.rarity-glow')).toContain(light);
  });

  it('shop goods cell: token name and light tone', async () => {
    const item = tokenItem(token(), '');
    await mount(ShopTradeCell, {
      cell: {
        index: 0,
        item,
        price: item.token!.price,
        affordable: true,
        sold: false,
        wasted: false,
        discountPercent: null,
      },
      kind: 'buy',
      testid: 'cell',
      priceTestid: 'price',
    });

    const cell = host.querySelector<HTMLElement>('[data-testid="cell"]')!;
    expect(cell.dataset.rarity).toBe(tone);
    expect(cell.getAttribute('aria-label')).toBe(tokenName(item.token!, 'en'));
    expect(background('.icon')).toContain(spriteOf(item.token!));
  });
});
