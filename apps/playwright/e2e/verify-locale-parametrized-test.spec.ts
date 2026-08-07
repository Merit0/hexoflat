import { test, expect } from '../support/fixtures';
import { loginAsTestUser, gotoCampingMap } from '../support/login';
import { getHeroCoordinates, moveHeroOneStep } from '../support/hex-board';

// Not a text-translation check (that's covered by the vitest completeness/
// placeholder/fallback tests in apps/web) — this proves nothing *functional*
// breaks when the locale changes, e.g. a plural/select branch in the ICU
// message compiler that an en-only run would never exercise.
const UI_SETTINGS_KEY = 'hexoflat:ui-settings:v1';

const LOCALES = ['uk', 'en'] as const;

const SETTINGS_CLOSE_LABEL: Record<(typeof LOCALES)[number], string> = {
  uk: 'Закрити',
  en: 'Close',
};

async function setLocale(page: import('@playwright/test').Page, locale: string): Promise<void> {
  await page.addInitScript(
    ({ key, locale }) => {
      localStorage.setItem(
        key,
        JSON.stringify({ showHeroMoveTrail: true, showEnemyVisionArea: true, locale }),
      );
    },
    { key: UI_SETTINGS_KEY, locale },
  );
}

for (const locale of LOCALES) {
  test.describe(`locale=${locale}`, () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test(`login flow works and settings-overlay resolves ${locale} text`, async ({
      page,
      workerTestUser,
    }) => {
      await setLocale(page, locale);
      await loginAsTestUser(page, workerTestUser);

      await expect(page.getByTestId('hex-map')).toBeVisible();

      await page.getByTestId('topbar-settings-button').click();
      await expect(page.getByTestId('settings-close-button')).toHaveText(
        SETTINGS_CLOSE_LABEL[locale],
      );

      await expect(page.getByTestId('settings-locale-select')).toHaveValue(locale);
    });
  });
}

for (const locale of LOCALES) {
  test.describe(`locale=${locale}`, () => {
    test(`hero movement still works with locale=${locale} active`, async ({ page }) => {
      await setLocale(page, locale);
      await gotoCampingMap(page);

      const before = await getHeroCoordinates(page);
      const after = await moveHeroOneStep(page);

      expect(after).not.toEqual(before);
    });
  });
}
