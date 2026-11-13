import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import type { TestChest, TestGroundItem, TestHexCoordinates } from '@framework/test-api';

const POLL_INTERVALS_MS = [50, 100, 200];
const SETTLE_TIMEOUT_MS = 10_000;

function coordinateKey(at: TestHexCoordinates): string {
  return `${at.columnIndex}:${at.rowIndex}`;
}

/**
 * Loot lying on the hex board and the chests it came from. State is asked of the app through
 * `window.__HEXOFLAT_TEST__`; the only locator is the canvas whose `data-ready` comes back once the
 * flying loot has landed.
 */
export class LootBoardComponent extends BaseComponent {
  private get canvas() {
    return this.page.getByTestId('hex-board-canvas');
  }

  async getGroundItems(): Promise<TestGroundItem[]> {
    return this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getGroundItems());
  }

  async getChests(): Promise<TestChest[]> {
    return this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getChests());
  }

  async waitUntilLootHasLanded(): Promise<void> {
    await expect(this.canvas).toHaveAttribute('data-ready', '1', { timeout: SETTLE_TIMEOUT_MS });
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.isLootFlying()), {
        intervals: POLL_INTERVALS_MS,
      })
      .toBe(false);
  }

  async verifyChestState(at: TestHexCoordinates, state: 'full' | 'empty'): Promise<void> {
    await expect
      .poll(
        async () =>
          (await this.getChests()).find(
            (chest) => coordinateKey(chest.coordinates) === coordinateKey(at),
          )?.state ?? null,
        { timeout: SETTLE_TIMEOUT_MS, intervals: POLL_INTERVALS_MS },
      )
      .toBe(state);
  }

  async waitForGroundItems(atLeast: number): Promise<TestGroundItem[]> {
    await expect
      .poll(async () => (await this.getGroundItems()).length, {
        timeout: SETTLE_TIMEOUT_MS,
        intervals: POLL_INTERVALS_MS,
      })
      .toBeGreaterThanOrEqual(atLeast);
    return this.getGroundItems();
  }

  async verifyNoGroundItems(): Promise<void> {
    await expect
      .poll(async () => (await this.getGroundItems()).length, {
        timeout: SETTLE_TIMEOUT_MS,
        intervals: POLL_INTERVALS_MS,
      })
      .toBe(0);
  }

  async fillTheBagWith(itemKey: string): Promise<void> {
    await this.page.evaluate(async (key) => {
      const hooks = window.__HEXOFLAT_TEST__!;
      const size = hooks.getBag().length;
      hooks.setBag(Array.from({ length: size }, () => ({ key, amount: 1 })));
      await hooks.settleInventorySync();
    }, itemKey);
  }

  async putTheHandDown(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.isToolUsed()), {
        intervals: POLL_INTERVALS_MS,
      })
      .toBe(false);
  }

  async tryOpenChest(at: TestHexCoordinates): Promise<void> {
    await this.page.evaluate(
      (coordinates) => window.__HEXOFLAT_TEST__!.tryOpenChest(coordinates),
      at,
    );
  }
}
