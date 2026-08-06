import { test, expect } from '@playwright/test';
import { gotoCampingMap } from '../support/login';
import {
  armHandTool,
  getInventoryItemKeys,
  getTileHexobjectKey,
  hoverTile,
  moveHeroAdjacentTo,
  CAMPING_AXE,
} from '../support/hex-board';

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
test('Verify any Tool can be taken on the map', async ({ page }) => {
  await gotoCampingMap(page);

  expect(await getInventoryItemKeys(page)).not.toContain('axe');
  expect(await getTileHexobjectKey(page, CAMPING_AXE)).toBe('axe');

  await moveHeroAdjacentTo(page, CAMPING_AXE);
  await armHandTool(page);
  await hoverTile(page, CAMPING_AXE);
  await page.getByTestId('tool-action-button').click();

  // TAKE starts as a pending action finished by the world tick loop
  // (250ms interval — see startWorldLoop in world-map-store.ts), so neither
  // the inventory update nor the tile clearing on the map is instant.
  await expect.poll(() => getInventoryItemKeys(page), { timeout: 5_000 }).toContain('axe');
  await expect.poll(() => getTileHexobjectKey(page, CAMPING_AXE), { timeout: 5_000 }).toBeNull();

  // The tool overlay stays open at the hero's hover (picking up more items
  // is still possible), but with nothing left to take it must stop
  // offering the Take action.
  await expect(page.getByTestId('tool-action-button')).toBeHidden();
});
