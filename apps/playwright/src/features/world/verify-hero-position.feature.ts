import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { ReloadCampingMapFeature } from '@features/world/reload-camping-map.feature';
import type { TestHexCoordinates } from '@framework/test-api';

export class VerifyHeroPositionFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async verifyChanged(previous: TestHexCoordinates): Promise<void> {
    await this.step('Verify the hero left its previous hex', () =>
      this.campingMap.hexBoard.verifyHeroMovedAwayFrom(previous),
    );
  }

  /**
   * Reloads and re-checks the *settled* position. The point is that the saved
   * placement genuinely survives a fresh boot, not that beforeunload's
   * best-effort flush happened to win a race against the new page. The reload
   * itself is delegated to ReloadCampingMapFeature rather than duplicated here
   * — it's an implementation detail of proving "survives a reload", not a
   * second business action this class performs.
   */
  async verifySurvivesReload(expected: TestHexCoordinates): Promise<void> {
    await this.step('Verify the hero position survives a reload', async () => {
      await new ReloadCampingMapFeature().reload();
      await this.campingMap.hexBoard.verifyHeroSettledAt(expected);
    });
  }
}
