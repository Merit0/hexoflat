import { afterEach, describe, expect, it } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { ETokenType } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { HeroDetailsView } from '@/composables/use-hero-details';
import { i18n } from '@/i18n';
import { LIGHT_NAME_COLOR } from '@/render/light';
import { tokenLightName } from '@/render/token-look';
import { tokenName } from '@/services/tokens/token-text';
import { baseTestToken, uniqueTestToken } from '@/test-support/token-fixtures';
import HeroHandsSection from './hero-hands-section.vue';

let app: App | null = null;
let host: HTMLElement;

async function mountHands(right: HeroDetailsView['hands']['right']) {
  host = document.createElement('div');
  document.body.appendChild(host);
  const view = { hands: { right, left: null } } as HeroDetailsView;
  app = createApp(HeroHandsSection, { view }).use(i18n);
  app.mount(host);
  await nextTick();
}

const nameText = () =>
  host.querySelector('[data-testid="hero-hand-right-name"]')?.textContent?.trim();
const color = () =>
  host
    .querySelector<HTMLElement>('[data-testid="hero-hand-right"]')
    ?.style.getPropertyValue('--light');

afterEach(() => {
  app?.unmount();
  host?.remove();
  app = null;
  i18n.global.locale.value = 'en';
});

describe('hero hands section reads the token (LG5c step 1)', () => {
  it.each([
    ['base', () => baseTestToken('sword', ETokenType.SPARK)],
    ['unique', () => uniqueTestToken('last-verdict')],
  ])('shows the %s token name and the colour of its light', async (_kind, make) => {
    const token = make();
    await mountHands({
      titleKey: 'Guard Sword',
      token,
      lightName: tokenLightName(token),
      willCost: null,
    });

    expect(nameText()).toBe(tokenName(token, 'en'));
    expect(color()).toBe(LIGHT_NAME_COLOR[tokenLightName(token)]);
  });

  it('renames the hand when the language changes', async () => {
    const token = baseTestToken('sword');
    await mountHands({ titleKey: 'Guard Sword', token, lightName: 'idol', willCost: null });

    i18n.global.locale.value = 'uk';
    await nextTick();

    expect(nameText()).toBe(tokenName(token, 'uk'));
  });
});
