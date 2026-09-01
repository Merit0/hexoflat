import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { BASE_HERO_HEALTH } from '@config/test-data';

export class VerifyCampingBoardFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async verifyBoardReady(): Promise<void> {
    await this.step('Verify the camping board is rendered and interactive', async () => {
      await this.campingMap.verifyUrlIsCamping();
      await this.campingMap.hexBoard.verifyIsVisible();
      await this.campingMap.heroBoardPanel.verifyIsVisible();
    });
  }

  async verifyMapChipIsCamping(): Promise<void> {
    await this.step('Verify the hero board names the camping map', async () => {
      await this.campingMap.heroBoardPanel.clickTab('hero');
      await this.campingMap.heroBoardPanel.verifyMapChipContains('Camping');
    });
  }

  /**
   * `GET /heroes/me` auto-creates the hero on its first fetch (heroes.service.ts's
   * findOrCreateByUserId). For a freshly registered user this *is* that first
   * fetch, which makes it the real regression check for the "0/100" bug:
   * without the fix no heroes row exists yet and the client falls back to
   * HeroModel's blank-slate defaults instead of the intended starting stats.
   *
   * Reads current/max HP straight from the store via the test API rather than
   * the DOM: the hero-board panel now renders HP as a row of heart icons
   * (SVG clipPath fills), which has no "10/10"-shaped text to assert on.
   */
  async verifyHeroStartsWithBaseHealth(): Promise<void> {
    await this.step(
      `Verify the hero starts at ${BASE_HERO_HEALTH.current}/${BASE_HERO_HEALTH.max} HP`,
      () => this.campingMap.heroBoardPanel.verifyHeroHealth(BASE_HERO_HEALTH),
    );
  }
}
