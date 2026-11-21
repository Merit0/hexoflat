import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import '@framework/test-api';

export class EquipmentCritComponent extends BaseComponent {
  async verifyStrike(critical: boolean, damage: number): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getLastBattleStrike()))
      .toMatchObject({ critical, damageBeforeBlock: damage, damageDealt: damage });
    await this.verifySavedHealth(30 - damage);
  }

  async verifySavedHealth(hp: number): Promise<void> {
    await expect
      .poll(() =>
        this.page.evaluate(
          () =>
            window
              .__HEXOFLAT_TEST__!.getBattleSnapshot()
              ?.creatures.find((creature) => creature.side === 'enemies')?.hp,
        ),
      )
      .toBe(hp);
  }
}
