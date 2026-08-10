import { test } from '@fixtures';
import { SetLocaleFeature } from '@features/settings/set-locale.feature';
import { OpenSettingsFeature } from '@features/settings/open-settings.feature';
import { VerifySettingsOverlayFeature } from '@features/settings/verify-settings-overlay.feature';
import { LoginUserFeature } from '@features/auth/login-user.feature';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { MoveHeroFeature } from '@features/world/move-hero.feature';
import { VerifyHeroPositionFeature } from '@features/world/verify-hero-position.feature';
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
      await new SetLocaleFeature(locale).setBeforeNavigation();
      await new LoginUserFeature(workerTestUser).login();
      await new OpenSettingsFeature().open();

      const verifySettings = new VerifySettingsOverlayFeature();
      await verifySettings.verifyCloseButtonLabel(SETTINGS_CLOSE_LABEL[locale]);
      await verifySettings.verifyLocaleSelectValue(locale);
    });
  });
}

for (const locale of SUPPORTED_LOCALES) {
  test.describe(`locale=${locale}`, () => {
    test(`hero movement still works with locale=${locale} active`, async () => {
      await new SetLocaleFeature(locale).setBeforeNavigation();
      await new OpenCampingMapFeature().open();

      const moveHero = new MoveHeroFeature();
      const positionBefore = await moveHero.readPosition();

      await moveHero.moveOneStep();

      await new VerifyHeroPositionFeature().verifyChanged(positionBefore);
    });
  });
}
