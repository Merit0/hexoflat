import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { MoveHeroFeature } from '@features/world/move-hero.feature';
import { UseHeroToolFeature } from '@features/world/use-hero-tool.feature';
import { Tool } from '@config/hero-tool';
import { tokenCoordinates, type MapToken } from '@config/test-data';

/**
 * Clicking OPEN on a chest with the bare HAND. Mirrors TakeTokenFeature's
 * shape but exercises the OPEN branch of the same START_HEX_ACTION pipeline
 * — see action-starters-registry.ts's EHexActionType.OPEN handler, which
 * currently always rejects (the open-a-chest-for-loot mechanic isn't
 * implemented yet), so this only ever proves the rejection surfaces to the
 * player, not that anything gets looted.
 */
export class OpenChestFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  constructor(private readonly token: MapToken) {
    super();
  }

  async open(): Promise<void> {
    await this.step(`Open whatever chest sits on "${this.token}"`, async () => {
      await new MoveHeroFeature().moveAdjacentTo(this.token);
      await new UseHeroToolFeature(Tool.HAND).use();

      await this.campingMap.hexBoard.hoverTile(tokenCoordinates(this.token));
      await this.campingMap.toolActionOverlay.triggerAction();
    });
  }
}
