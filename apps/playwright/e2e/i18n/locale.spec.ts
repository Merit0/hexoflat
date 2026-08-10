import { test } from '@fixtures';
import { LocaleFeature } from '@features/settings/locale.feature';
import { SettingsFeature } from '@features/settings/settings.feature';
import { LoginUserFeature } from '@features/auth/login-user.feature';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { MoveHeroFeature } from '@features/world/move-hero.feature';
import { SETTINGS_CLOSE_LABEL, SUPPORTED_LOCALES } from '@config/test-data';

// Not a text-translation check (apps/web's vitest completeness/placeholder/
// fallback suites cover that) — this proves nothing *functional* breaks when
// the locale changes, e.g. a plural/select branch in the ICU message compiler
// that an en-only run would never exercise.

for (const locale of SUPPORTED_LOCALES) {
  test.describe(`locale=${locale}`, () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test(`login flow works and settings-overlay resolves ${locale} text`, async ({
      workerTestUser,
    }) => {
      await new LocaleFeature(locale).applyBeforeNavigation();
      await new LoginUserFeature(workerTestUser).login();

      const settings = new SettingsFeature();
      await settings.open();
      await settings.verifyCloseButtonLabel(SETTINGS_CLOSE_LABEL[locale]);
      await settings.verifyLocaleSelectValue(locale);
    });
  });
}

for (const locale of SUPPORTED_LOCALES) {
  test.describe(`locale=${locale}`, () => {
    test(`hero movement still works with locale=${locale} active`, async () => {
      await new LocaleFeature(locale).applyBeforeNavigation();
      await new OpenCampingMapFeature().open();

      const moveHero = new MoveHeroFeature();
      const positionBefore = await moveHero.readPosition();

      await moveHero.moveOneStep();

      await moveHero.verifyPositionChanged(positionBefore);
    });
  });
}
