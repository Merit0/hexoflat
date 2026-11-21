import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import '@framework/test-api';

export class EquipmentTrophyComponent extends BaseComponent {
  private savedItems: unknown = null;

  async verifyLethalBonus(bonus: number): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getBattleTrophy()?.corpses))
      .toEqual([expect.objectContaining({ bonus })]);
  }

  async rememberLoot(): Promise<void> {
    const state = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getBattleTrophy());
    expect(state!.items.length).toBeGreaterThan(0);
    this.savedItems = state!.items;
  }

  async verifyLootPreserved(): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getBattleTrophy()?.items))
      .toEqual(this.savedItems);
  }
}
