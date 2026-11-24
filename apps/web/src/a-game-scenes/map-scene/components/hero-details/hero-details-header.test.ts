import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { EDimension } from '@hexoflat/engine/dimensions/dimensions';
import type { LocationKey } from '@hexoflat/engine/registry/location-key';
import { MapRegistry } from '@hexoflat/engine/registry/world-map-registry';
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

const metaTexts = () =>
  [...host.querySelectorAll('[data-testid="hero-details-meta"] > *')].map((node) =>
    node.textContent?.trim(),
  );
const heroName = () => host.querySelector('[data-testid="topbar-hero-name"]')?.textContent?.trim();

describe('hero details header: the hero name and the location only', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });
  afterEach(() => {
    app?.unmount();
    host.remove();
    i18n.global.locale.value = startLocale;
  });

  it.each([
    ['en', 'No location'],
    ['uk', 'Без локації'],
  ] as const)(
    'DA8b: a hero without a location shows no dimension name in %s',
    async (locale, text) => {
      useHeroStore().nav.locationKey = null as unknown as LocationKey;
      i18n.global.locale.value = locale;
      mount();
      await nextTick();
      expect(metaTexts()).toEqual([heroName(), text]);
    },
  );

  it.each(Object.values(EDimension))(
    'shows only the location name to a hero of origin %s',
    async (dimension) => {
      expect(useHeroStore().nav.locationKey).toBe('camping');
      useHeroStore().hero.origin = dimension;
      mount();
      await nextTick();
      expect(metaTexts()).toEqual([heroName(), MapRegistry.get('camping').title]);
    },
  );
});
