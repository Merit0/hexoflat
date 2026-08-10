import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { BASE_HERO_HEALTH } from '@config/test-data';

export class VerifyCampingBoardFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async verifyBoardReady(): Promise<void> {
    await this.step('Verify the camping board is rendered and interactive', async () => {
      await this.campingMap.verifyUrlIsCamping();
      await this.campingMap.hexBoard.verifyIsVisible();
      await this.campingMap.topbar.verifyIsVisible();
    });
  }

  async verifyMapChipIsCamping(): Promise<void> {
    await this.step('Verify the top bar names the camping map', async () => {
      await this.campingMap.topbar.verifyMapChipContains('Camping');
    });
  }

  /**
   * `GET /heroes/me` auto-creates the hero on its first fetch (heroes.service.ts's
   * findOrCreateByUserId). For a freshly registered user this *is* that first
   * fetch, which makes it the real regression check for the "0/100" bug:
   * without the fix no heroes row exists yet and the client falls back to
   * HeroModel's blank-slate defaults instead of the intended starting stats.
   */
  async verifyHeroStartsWithBaseHealth(): Promise<void> {
    await this.step(`Verify the hero starts at ${BASE_HERO_HEALTH} HP`, async () => {
      await this.campingMap.topbar.verifyHeroHealth(BASE_HERO_HEALTH);
    });
  }
}
