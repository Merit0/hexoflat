import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './support/login';
import {
  armHandTool,
  getInventoryItemKeys,
  hoverTile,
  moveHeroAdjacentTo,
  CAMPING_AXE,
} from './support/hex-board';

/**
 * There is no in-game way yet to reach a TREE/ROCK (the RESOURCE group) —
 * those only exist on the 'silesia' map, and cutting/mining them needs an
 * AXE/PICKAXE the hero doesn't start with (see resources.content.ts's
 * `requiredTool`). Picking up the starter AXE placed in the safe camping
 * zone (map-tiles-schema-provider.ts's `campingMapConfig`) is the simplest
 * real exercise of the same START_HEX_ACTION → TAKE pipeline without also
 * depending on cross-map travel or fog-of-war reveal, which is why this is
 * its own test rather than folded into move-hero.spec.ts.
 */
test('picking up the starter axe adds it to the inventory', async ({ page }) => {
  await loginAsTestUser(page);

  expect(await getInventoryItemKeys(page)).not.toContain('axe');

  await moveHeroAdjacentTo(page, CAMPING_AXE);
  await armHandTool(page);
  await hoverTile(page, CAMPING_AXE);
  await page.getByTestId('tool-action-button').click();

  // TAKE starts as a pending action finished by the world tick loop
  // (250ms interval — see startWorldLoop in world-map-store.ts), so the
  // inventory update isn't instant.
  await expect.poll(() => getInventoryItemKeys(page), { timeout: 5_000 }).toContain('axe');
});
