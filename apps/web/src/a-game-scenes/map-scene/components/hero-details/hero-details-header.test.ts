import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { EDimension } from '@hexoflat/engine/dimensions/dimensions';
import { i18n } from '@/i18n';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroDetails } from '@/composables/use-hero-details';
import HeroDetailsHeader from './hero-details-header.vue';

let app: App | null = null;
let host: HTMLElement;
const startLocale = i18n.global.locale.value;

function mount() {
  host = document.createElement('div');
  document.body.appendChild(host);
  app = createApp({
    components: { HeroDetailsHeader },
    setup: () => ({ view: useHeroDetails() }),
    template: '<hero-details-header :view="view" />',
  }).use(i18n);
  app.mount(host);
}

const origin = () => host.querySelector('[data-testid="hero-details-origin"]')?.textContent?.trim();

describe('DA7-2: hero details show the hero origin', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });
  afterEach(() => {
    app?.unmount();
    host.remove();
    i18n.global.locale.value = startLocale;
  });

  it('follows the language', async () => {
    mount();
    i18n.global.locale.value = 'en';
    await nextTick();
    expect(origin()).toBe('Origin: Nowhere');
    i18n.global.locale.value = 'uk';
    await nextTick();
    expect(origin()).toBe('Походження: Ніде');
  });

  it.each(Object.values(EDimension))('shows the origin %s of the hero', async (dimension) => {
    useHeroStore().hero.origin = dimension;
    mount();
    await nextTick();
    expect(origin()).toBe(
      i18n.global.t('dimensions.origin', { name: i18n.global.t(`dimensions.${dimension}`) }),
    );
  });

  it('keeps the dimension of the location beside it', async () => {
    useHeroStore().nav.locationKey = 'camping';
    mount();
    await nextTick();
    const labels = [...host.querySelectorAll('.dimension')].map((node) => node.textContent?.trim());
    expect(labels).toEqual([
      i18n.global.t('dimensions.label', { name: i18n.global.t('dimensions.earth') }),
      i18n.global.t('dimensions.origin', { name: i18n.global.t('dimensions.nowhere') }),
    ]);
  });
});
