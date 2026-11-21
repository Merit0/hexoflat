import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia } from 'pinia';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { resolveItemTooltip } from '@hexoflat/engine/utils/inventory/item-tooltip';
import {
  LEGACY_SHIELD,
  LEGACY_SWORD,
  LEGACY_UNIQUE,
} from '@hexoflat/engine/tokens/legacy-token-fixtures';
import type { ItemToken } from '@hexoflat/engine/tokens/token-schema';
import { i18n } from '@/i18n';
import { withToken } from '@/composables/use-item-tooltip';
import ItemTooltip from './item-tooltip.vue';

let app: App | null = null;
let host: HTMLElement;

async function showTooltip(token: ItemToken) {
  host = document.createElement('div');
  document.body.appendChild(host);
  const view = withToken(resolveItemTooltip(token.type as typeof K.SWORD), token);
  app = createApp(ItemTooltip, { view }).use(createPinia()).use(i18n);
  app.mount(host);
  await nextTick();
}

const text = (testid: string) =>
  host.querySelector(`[data-testid="${testid}"]`)?.textContent?.trim() ?? '';
const all = (testid: string) =>
  [...host.querySelectorAll(`[data-testid="${testid}"]`)].map((node) =>
    node.textContent?.replace(/\s+/g, ' ').trim(),
  );

beforeEach(() => {
  i18n.global.locale.value = 'en';
});

afterEach(() => {
  app?.unmount();
  host?.remove();
  app = null;
  i18n.global.locale.value = 'en';
});

describe('the item tooltip of a saved generator v3 token (characterization)', () => {
  it.each([
    [LEGACY_SWORD, "Weaver's Bitter Sword", ['Sword · Gloom', 'Strike 1', 'Health: +1', 'Tier 3']],
    [LEGACY_SHIELD, "Bridge's Shield", ['Shield · Gloom', 'Strike 0.5', 'Health: +1', 'Tier 3']],
    [
      LEGACY_UNIQUE,
      'Lantern-Eater',
      [
        'Forged in a shaft where no lamp stayed lit.',
        'Sword · Gloom',
        'Strike 1',
        'Health: +0.5',
        'Tier 3',
      ],
    ],
  ])('shows the old name and the baked lines once (%#)', async (token, title, lines) => {
    await showTooltip(token);

    expect(text('item-tooltip-title')).toBe(title);
    expect(all('item-tooltip-line')).toEqual(lines);
    expect(all('item-tooltip-attribute')).toEqual([]);
  });

  it('shows the Ukrainian name and lines of an old token', async () => {
    i18n.global.locale.value = 'uk';
    await showTooltip(LEGACY_SWORD);

    expect(text('item-tooltip-title')).toBe('Меч Полину Ткача');
    expect(all('item-tooltip-line')).toEqual(['Меч · Морок', 'Удар 1', 'Життя: +1', 'Рівень 3']);
  });
});
