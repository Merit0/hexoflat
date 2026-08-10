import { parameter } from 'allure-js-commons';
import { BaseFeature } from '@framework/base-feature';
import { UI_SETTINGS_STORAGE_KEY, type SupportedLocale } from '@config/test-data';

export class LocaleFeature extends BaseFeature {
  constructor(private readonly locale: SupportedLocale) {
    super();
  }

  /**
   * Seeds the persisted UI settings via an init script, so the locale is
   * already in localStorage before the app's first boot reads it. Switching it
   * through the UI afterwards would test a different thing entirely — the
   * point here is that a *cold start* in this locale works.
   *
   * Must be called before any navigation in the test.
   */
  async applyBeforeNavigation(): Promise<void> {
    await this.step(`Start the app in locale "${this.locale}"`, async () => {
      // Surfaces the locale as a first-class Allure parameter — filterable in
      // the report and visible on the test-case page — instead of being
      // readable only by parsing it out of the test title.
      //
      // It deliberately does NOT merge the per-locale runs into one test case
      // with two variants: Allure keys a case on its full title path, and the
      // specs keep distinct per-locale titles because two identically-named
      // tests would be indistinguishable in the console and in `-g` filters.
      // Readability day to day beat a slightly tidier history graph.
      //
      // Declared here rather than in the spec so specs stay free of reporting
      // concerns — the same reason `test.step` lives in BaseFeature.
      await parameter('locale', this.locale);

      await this.page.addInitScript(
        ({ key, locale }) => {
          localStorage.setItem(
            key,
            JSON.stringify({ showHeroMoveTrail: true, showEnemyVisionArea: true, locale }),
          );
        },
        { key: UI_SETTINGS_STORAGE_KEY, locale: this.locale },
      );
    });
  }
}
