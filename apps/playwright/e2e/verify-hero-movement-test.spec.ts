import { test, expect } from '@playwright/test';
import { loginAsTestUser } from '../support/login';
import { getHeroCoordinates, moveHeroOneStep } from '../support/hex-board';

test('Verify clicking an adjacent tile moves the hero there', async ({ page }) => {
  await loginAsTestUser(page);

  const before = await getHeroCoordinates(page);
  const stepsBefore = await page.getByTestId('topbar-steps-chip').innerText();

  const after = await moveHeroOneStep(page);

  expect(after).not.toEqual(before);
  await expect(page.getByTestId('topbar-steps-chip')).not.toHaveText(stepsBefore);
});
