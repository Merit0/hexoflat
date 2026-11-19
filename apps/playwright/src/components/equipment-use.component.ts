import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

export class EquipmentUseComponent extends BaseComponent {
  async verifyPotionEquipped(): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getBattleHands()?.right))
      .toBe('health-potion');
  }

  async verifyPrice(cost: number, enabled: boolean): Promise<void> {
    const hand = this.page.getByTestId('battle-hand-right');
    await expect(hand).toContainText(new RegExp(`(?:use|використати) ${cost}(?![0-9])`, 'i'));
    if (enabled) await expect(hand).toBeEnabled();
    else await expect(hand).toBeDisabled();
  }

  async selectPotion(cost: number): Promise<void> {
    const hand = this.page.getByTestId('battle-hand-right');
    await expect(hand).toBeEnabled();
    await expect(hand).toContainText(new RegExp(`(?:use|використати) ${cost}(?![0-9])`, 'i'));
    await hand.click();
  }
}
