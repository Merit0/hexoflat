import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { OpenCampingMapFeature } from './open-camping-map.feature';
import { ShieldMaxHealthFeature } from './shield-max-health.feature';
import { SwitchHeroBoardTabFeature } from './switch-hero-board-tab.feature';
import '@framework/test-api';

export class EquipmentWillFeature extends BaseFeature {
  private readonly map = new CampingMapPage();
  private readonly shield = new ShieldMaxHealthFeature();

  async startWithWillBonus(bonus: number, current = 50, mapTier: 1 | 2 | 3 | 4 = 1): Promise<void> {
    await this.step(
      `Start with an owned Will +${bonus} token in the bag and ${current} Will`,
      async () => {
        await new OpenCampingMapFeature().open();
        await this.page.evaluate(
          ({ bonus, mapTier }) => window.__HEXOFLAT_TEST__!.grantWillToken(bonus, mapTier),
          { bonus, mapTier },
        );
        await this.setWill(current);
      },
    );
  }

  async setWill(current: number): Promise<void> {
    await this.step(`Fill Will to ${current} through the server fixture`, async () => {
      await this.page.evaluate(async (value) => {
        window.__HEXOFLAT_TEST__!.setWill(value);
        await window.__HEXOFLAT_TEST__!.settleInventorySync();
      }, current);
    });
  }

  async equip(): Promise<void> {
    await this.step('Equip the token with a real inventory drag', () => this.shield.equipShield());
  }

  async unequip(): Promise<void> {
    await this.step('Take the Will token off through the hand icon', () =>
      this.shield.takeShieldOffWithTheHandIcon(),
    );
  }

  async verifyWill(current: number, capacity: number): Promise<void> {
    await this.step(
      `Verify ${current}/${capacity} Will in the server projection and hero panel`,
      async () => {
        await new SwitchHeroBoardTabFeature().switchTo('hero');
        await this.map.equipmentWill.verifyWill(current, capacity);
      },
    );
  }

  async reload(): Promise<void> {
    await this.step('Reload the server-held hero', async () => {
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
      await this.map.reload();
      await this.map.waitUntilReady();
    });
  }
}
