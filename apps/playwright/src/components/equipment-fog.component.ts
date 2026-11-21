import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import type { TestFogTile, TestHexCoordinates } from '@framework/test-api';
import '@framework/test-api';

export class EquipmentFogComponent extends BaseComponent {
  private before: TestFogTile[] = [];
  private target: TestHexCoordinates | null = null;
  private saved: TestFogTile[] = [];

  async prepareStep(): Promise<TestHexCoordinates> {
    await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
    const target = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.findFogStep());
    if (!target) throw new Error('No visible step with unexplored tiles in sight rings 2 and 3');
    this.target = target;
    this.before = await this.readFog(target);
    return target;
  }

  private readFog(center: TestHexCoordinates): Promise<TestFogTile[]> {
    return this.page.evaluate((at) => window.__HEXOFLAT_TEST__!.getFogTiles(at), center);
  }

  async verifyRevealedRadius(radius: number): Promise<void> {
    const at = this.target!;
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getHeroCoordinates()))
      .toEqual(at);
    await expect
      .poll(async () =>
        (await this.readFog(at)).filter((tile) => tile.distance <= radius && !tile.revealed),
      )
      .toEqual([]);
    const after = await this.readFog(at);
    for (const [index, tile] of after.entries()) {
      expect(tile.revealed, `fog at ${JSON.stringify(tile.coordinates)}`).toBe(
        this.before[index].revealed || tile.distance <= radius,
      );
    }
    if (radius > 1) {
      expect(
        after.some(
          (tile, index) =>
            tile.distance === radius && !this.before[index].revealed && tile.revealed,
        ),
      ).toBe(true);
    }
    this.saved = after;
    await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
  }

  async verifySavedFog(): Promise<void> {
    await expect.poll(() => this.readFog(this.target!)).toEqual(this.saved);
  }
}
