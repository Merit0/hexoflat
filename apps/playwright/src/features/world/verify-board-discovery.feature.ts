import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';

/**
 * The four-state discovery model as the running app reports it.
 *
 * E1 replaced `isRevealed: boolean` on the tile with
 * `discovery: UNKNOWN | OBSERVED | DISCOVERED | UNDERSTOOD`, keeping the
 * boolean as a derived shim so 30+ call sites did not have to move. That is a
 * change to the type every map, save and renderer path in the game runs
 * through, and the risk it carries is not a crash — it is the live game
 * quietly rendering or revealing something different. These checks pin the
 * pre-slice behaviour in the real app rather than in a unit test's idea of it.
 */
export class VerifyBoardDiscoveryFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  /**
   * Camping is an `ALL_REVEALED` map, so every tile must come back
   * `DISCOVERED` — the shim's translation of the boolean the map was built
   * with, observed end to end.
   */
  async verifyRevealedMapReadsAsDiscovered(): Promise<void> {
    await this.step('Verify a revealed tile reports DISCOVERED, not the old boolean', async () => {
      const hero = await this.campingMap.hexBoard.requireHeroCoordinates();
      await this.campingMap.hexBoard.verifyTileDiscovery(hero, 'DISCOVERED');
    });
  }

  /**
   * Camping has no UNKNOWN hexes, so this is a wiring check on the live
   * board, not the regression net for the frontier filter — see the note on
   * `verifyWholeGridIsRendered`.
   */
  async verifyRevealedMapRendersEveryHex(): Promise<void> {
    await this.step('Verify a fully revealed map puts its whole grid on screen', async () => {
      await this.campingMap.hexBoard.verifyWholeGridIsRendered();
    });
  }

  async verifyDiscoverySurvivesAStep(): Promise<void> {
    await this.step('Verify the hex the hero steps onto reports DISCOVERED', async () => {
      const moved = await this.campingMap.hexBoard.moveOneStep();
      await this.campingMap.hexBoard.verifyTileDiscovery(moved, 'DISCOVERED');
    });
  }
}
