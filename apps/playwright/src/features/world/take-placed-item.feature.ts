import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { UseHeroToolFeature } from '@features/world/use-hero-tool.feature';
import { Tool } from '@config/hero-tool';
import type { TestHexCoordinates } from '@framework/test-api';

/**
 * Picks up an item with the bare HAND through the real TAKE pipeline. The camp map no longer holds
 * loose gear, so the item is put on a free hex next to the hero first (the test hook that places a
 * hexobject by key), and then taken exactly like a player would.
 */
export class TakePlacedItemFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();
  private coordinates: TestHexCoordinates | null = null;

  constructor(private readonly key: string) {
    super();
  }

  async place(): Promise<void> {
    await this.step(`Put "${this.key}" on a free hex next to the hero`, async () => {
      this.coordinates = await this.campingMap.hexBoard.placeItemNextToHero(this.key);
    });
  }

  async take(): Promise<void> {
    await this.step(`Take the "${this.key}" lying next to the hero`, async () => {
      if (!this.coordinates) await this.place();
      await new UseHeroToolFeature(Tool.HAND).use();
      await this.campingMap.hexBoard.hoverTile(this.requireCoordinates());
      await this.campingMap.toolActionOverlay.triggerAction();
    });
  }

  async verifyIsOnTheMap(): Promise<void> {
    await this.step(`Verify "${this.key}" lies on the map`, () =>
      this.campingMap.hexBoard.verifyTileHoldsHexobject(this.requireCoordinates(), this.key),
    );
  }

  async verifyIsTaken(): Promise<void> {
    await this.step(`Verify "${this.key}" left the map`, () =>
      this.campingMap.hexBoard.verifyTileIsCleared(this.requireCoordinates()),
    );
  }

  private requireCoordinates(): TestHexCoordinates {
    if (!this.coordinates) throw new Error(`"${this.key}" has not been placed yet.`);
    return this.coordinates;
  }
}
