import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

/**
 * The hero's inventory — read from live app state via
 * `window.__HEXOFLAT_TEST__`, not from the in-game overlay.
 *
 * Opening that overlay requires clicking the hero's own tile, which lives on
 * a separate interactive PixiJS layer stacked exactly on top of the tile grid
 * (render/layers/hero-layer.ts). Unlike every other board click the suite
 * does, that one could not be made to register reliably through Playwright's
 * synthesized pointer events. Reading the same state the overlay renders
 * sidesteps that without weakening the assertion.
 */

const INVENTORY_POLL_TIMEOUT_MS = 5_000;
const POLL_INTERVALS_MS = [100];

export class HeroInventoryComponent extends BaseComponent {
  async getItemKeys(): Promise<string[]> {
    return this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getInventoryItemKeys());
  }

  /**
   * TAKE starts as a pending action finished by the 250ms world tick loop
   * (world-map-store.ts's startWorldLoop), so the inventory update is not
   * instant.
   */
  async verifyContainsItem(itemKey: string): Promise<void> {
    await expect
      .poll(() => this.getItemKeys(), {
        timeout: INVENTORY_POLL_TIMEOUT_MS,
        intervals: POLL_INTERVALS_MS,
      })
      .toContain(itemKey);
  }

  async verifyDoesNotContainItem(itemKey: string): Promise<void> {
    expect(await this.getItemKeys()).not.toContain(itemKey);
  }
}
