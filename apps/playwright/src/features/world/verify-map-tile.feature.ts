import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { tokenCoordinates, type MapToken } from '@config/test-data';

export class VerifyMapTileFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  constructor(private readonly token: MapToken) {
    super();
  }

  async verifyHoldsObject(hexobjectKey: string): Promise<void> {
    await this.step(`Verify "${this.token}" still holds a "${hexobjectKey}"`, () =>
      this.campingMap.hexBoard.verifyTileHoldsHexobject(tokenCoordinates(this.token), hexobjectKey),
    );
  }

  /** Confirms the object left the *map*, not just that the inventory grew. */
  async verifyCleared(): Promise<void> {
    await this.step(`Verify "${this.token}" is now empty`, () =>
      this.campingMap.hexBoard.verifyTileIsCleared(tokenCoordinates(this.token)),
    );
  }
}
