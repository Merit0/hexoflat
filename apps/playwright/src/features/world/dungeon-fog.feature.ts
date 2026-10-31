import { expect } from '@playwright/test';
import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { SquadActionsFeature } from '@features/world/squad-actions.feature';

export class DungeonFogFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async openTheCaveAndVerifyItsMistHex(): Promise<void> {
    await this.step('The generated cave covers its hidden hexes with the mist hex', async () => {
      const verifyLoaded = await this.campingMap.hexBoard.watchSprite(/fog-hex\.png/);
      await new SquadActionsFeature().openCave();
      await verifyLoaded();
    });
  }

  async openTheCaveAndVerifyTheExitIsOnTheBorder(): Promise<void> {
    await this.step(
      'The cave exit is part of the border and the hero stands beside it',
      async () => {
        await new SquadActionsFeature().openCave();
        const exits = await this.campingMap.hexBoard.findTilesWithKey('cave-exit');
        expect(exits).toHaveLength(1);
        const missing = 6 - (await this.campingMap.hexBoard.countExistingNeighbours(exits[0]));
        expect(missing, 'a border tile has neighbours that are void').toBeGreaterThan(0);
        await expect
          .poll(async () => {
            const hero = await this.campingMap.hexBoard.readHeroCoordinates();
            return hero ? this.campingMap.hexBoard.distanceBetween(hero, exits[0]) : -1;
          })
          .toBe(1);
      },
    );
  }
}
