import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { readTestUser } from './credentials';
import { waitForHeroPlaced } from './hex-board';

export async function waitForCampingMapReady(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/world\/camping/);
  await expect(page.getByTestId('map-scene-root')).toBeVisible();
  // The board canvas is only sized (and clickable at the right position)
  // once mapBounds settles — see the ResizeObserver comment in
  // hex-world-map.vue. Waiting for a non-zero box up front means every
  // later canvas click already lands on real geometry.
  await expect
    .poll(async () => (await page.getByTestId('hex-board-canvas').boundingBox())?.width ?? 0)
    .toBeGreaterThan(0);
  await waitForHeroPlaced(page);
}

export async function loginAsTestUser(page: Page): Promise<void> {
  const user = readTestUser();

  await page.goto('/');
  await page.getByTestId('login-username-input').fill(user.username);
  await page.getByTestId('login-password-input').fill(user.password);
  await page.getByTestId('login-submit-button').click();

  await waitForCampingMapReady(page);
}

// For specs that don't care about the login flow itself — the browser
// context is already pre-authenticated via the shared storage state (see
// playwright.config.ts / global-setup.ts), so this never touches the login
// form or /auth/login's throttle bucket at all.
export async function gotoCampingMap(page: Page): Promise<void> {
  await page.goto('/world/camping');
  await waitForCampingMapReady(page);
}
