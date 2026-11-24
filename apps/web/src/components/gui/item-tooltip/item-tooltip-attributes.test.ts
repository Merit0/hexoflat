import { afterEach, describe, expect, it } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia } from 'pinia';
import { EQUIPMENT_ATTRIBUTES } from '@hexoflat/engine';
import { ETokenType } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { resolveItemTooltip } from '@hexoflat/engine/utils/inventory/item-tooltip';
import { createTokenFactory } from '@hexoflat/engine/tokens/factory/create-token-factory';
import type { ItemToken } from '@hexoflat/engine/tokens/token-schema';
import { i18n } from '@/i18n';
import { withToken } from '@/composables/use-item-tooltip';
import { tokenAttributeRows, tokenDictionary } from '@/services/tokens/token-text';
import { ICON_PATHS, type TIconName } from '@/components/gui/icons/item-icons';
import ItemTooltip from './item-tooltip.vue';

const IMPLEMENTED = EQUIPMENT_ATTRIBUTES.filter((attribute) => attribute.implemented);
const LOCALES = ['en', 'uk'] as const;

let app: App | null = null;
let host: HTMLElement;

function shieldWith(attributes: ItemToken['attributes']): ItemToken {
  const result = createTokenFactory().createBase(
    {
      seed: 'ea-13',
      sourceId: 'test:ea13',
      n: 0,
      tokenType: ETokenType.IDOL,
      mapTier: 4,
      type: K.SHIELD,
    },
    { attributes },
  );
  if (!result.ok) throw new Error(JSON.stringify(result.refusal));
  return result.value;
}

async function showTooltip(token: ItemToken) {
  host = document.createElement('div');
  document.body.appendChild(host);
  const view = withToken(resolveItemTooltip(K.SHIELD), token);
  app = createApp(ItemTooltip, { view }).use(createPinia()).use(i18n);
  app.mount(host);
  await nextTick();
}

function localeText(locale: string, key: string): string | undefined {
  return tokenDictionary(locale)[key];
}

afterEach(() => {
  app?.unmount();
  host?.remove();
  app = null;
  i18n.global.locale.value = 'en';
});

describe('EA-13: attribute rows of a new token', () => {
  it('has at least one implemented attribute to show', () => {
    expect(IMPLEMENTED.map((attribute) => attribute.key)).toContain('heart');
  });

  describe.each(LOCALES)('in %s', (locale) => {
    it.each(IMPLEMENTED.map((attribute) => [attribute.key, attribute] as const))(
      'shows %s as a label, an icon and a value',
      async (_key, attribute) => {
        i18n.global.locale.value = locale;
        // Rendering also supports owned attributes that this type cannot roll now.
        const token = {
          ...shieldWith([]),
          attributes: [{ key: attribute.key, value: 1 }],
        };
        const [row] = tokenAttributeRows(token, locale);

        expect(row.label).toBe(localeText(locale, attribute.display.labelKey));
        expect(row.label).not.toBe(attribute.display.labelKey);
        expect(Object.keys(ICON_PATHS)).toContain(row.icon);
        expect(row.value).toMatch(/\d/);

        await showTooltip(token);
        const nodes = [...host.querySelectorAll('[data-testid="item-tooltip-attribute"]')];
        expect(nodes).toHaveLength(1);
        expect(nodes[0].textContent?.replace(/\s+/g, ' ').trim()).toBe(`${row.label} ${row.value}`);
        expect(nodes[0].querySelector('path')?.getAttribute('d')).toBe(
          ICON_PATHS[row.icon as TIconName],
        );
      },
    );
  });

  it.each([
    ['en', 'Health:'],
    ['uk', 'Життя:'],
  ])('labels health bonuses correctly in %s', (locale, label) => {
    expect(tokenAttributeRows(shieldWith([{ key: 'heart', value: 1 }]), locale)[0]).toMatchObject({
      label,
      value: '+0.5',
    });
  });

  it('stores no attribute line, so the description lines hold no attribute', async () => {
    const token = shieldWith([{ key: 'heart', value: 1 }]);
    await showTooltip(token);
    const lines = [...host.querySelectorAll('[data-testid="item-tooltip-line"]')].map(
      (node) => node.textContent?.trim() ?? '',
    );
    expect(lines.some((line) => line.startsWith('Health:'))).toBe(false);
  });

  it('names a new token by an adjective and the noun in both languages', async () => {
    const token = shieldWith([{ key: 'heart', value: 1 }]);
    expect(token.name.kind).toBe('adjective');
    for (const locale of LOCALES) {
      i18n.global.locale.value = locale;
      await showTooltip(token);
      const title = host.querySelector('[data-testid="item-tooltip-title"]')?.textContent?.trim();
      expect(title?.split(' ')).toHaveLength(2);
      app?.unmount();
      host.remove();
      app = null;
    }
  });
});
