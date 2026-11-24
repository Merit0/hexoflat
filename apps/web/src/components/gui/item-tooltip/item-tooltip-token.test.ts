import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia } from 'pinia';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { resolveItemTooltip } from '@hexoflat/engine/utils/inventory/item-tooltip';
import type { ItemToken } from '@hexoflat/engine/tokens/token-schema';
import { i18n } from '@/i18n';
import { withToken } from '@/composables/use-item-tooltip';
import { tokenDescription, tokenName } from '@/services/tokens/token-text';
import { baseTestToken, uniqueTestToken } from '@/test-support/token-fixtures';
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
const lines = () =>
  [...host.querySelectorAll('[data-testid="item-tooltip-line"]')].map((line) =>
    line.textContent?.trim(),
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

describe('the item tooltip shows the token name and description (LG5c step 2)', () => {
  it('shows the generated English name of a base token', async () => {
    const token = baseTestToken('sword');
    await showTooltip(token);

    expect(text('item-tooltip-title')).toBe(tokenName(token, 'en'));
    expect(text('item-tooltip-title')).not.toBe('Guard Sword');
  });

  it('shows the Ukrainian name in the uk locale', async () => {
    const token = baseTestToken('sword');
    i18n.global.locale.value = 'uk';
    await showTooltip(token);

    expect(text('item-tooltip-title')).toBe(tokenName(token, 'uk'));
    expect(tokenName(token, 'uk')).not.toBe(tokenName(token, 'en'));
  });

  it('changes the name and the description at once when the language changes', async () => {
    const token = uniqueTestToken('lantern-eater');
    await showTooltip(token);
    expect(text('item-tooltip-title')).toBe(tokenName(token, 'en'));

    i18n.global.locale.value = 'uk';
    await nextTick();

    expect(text('item-tooltip-title')).toBe(tokenName(token, 'uk'));
    expect(lines()[0]).toBe(tokenDescription(token, 'uk')[0]);
  });

  it('takes the hearts from the heart attribute, not from the old shield', async () => {
    const shield = { ...baseTestToken('shield'), attributes: [] };
    await showTooltip(shield);

    expect(host.querySelector('[data-testid="item-tooltip-hearts"]')).toBeNull();
  });
});
