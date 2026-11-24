import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { tokenCoordinates, type MapToken } from '@config/test-data';
import type { HexInfoSealState } from '@components/hex-info-tooltip.component';

export class HexInfoTooltipFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async hoverToken(token: MapToken): Promise<void> {
    await this.step(`Hover the hex "${token}"`, () =>
      this.campingMap.hexBoard.hoverTileForInfo(tokenCoordinates(token)),
    );
  }

  async placeItemAndHover(hexobjectKey: string): Promise<void> {
    await this.step(`Put "${hexobjectKey}" next to the hero and hover it`, async () => {
      const at = await this.campingMap.hexBoard.placeItemNextToHero(hexobjectKey);
      await this.campingMap.hexBoard.hoverTileForInfo(at);
    });
  }

  async hoverFirstHexWithKey(hexobjectKey: string): Promise<void> {
    await this.step(`Hover the first hex holding "${hexobjectKey}"`, async () => {
      const [first] = await this.campingMap.hexBoard.findTilesWithKey(hexobjectKey);
      if (!first) throw new Error(`No hex holds "${hexobjectKey}" on the camping map.`);
      await this.campingMap.hexBoard.hoverTileForInfo(first);
    });
  }

  async verifyShowsTitle(title: RegExp): Promise<void> {
    await this.step(`Verify the hover card shows "${title}"`, async () => {
      await this.campingMap.hexInfoTooltip.verifyTitle(title);
    });
  }

  async verifySealState(state: HexInfoSealState): Promise<void> {
    await this.step(`Verify the hover card seal is "${state}"`, () =>
      this.campingMap.hexInfoTooltip.verifySealState(state),
    );
  }

  async leaveTheBoard(): Promise<void> {
    await this.step('Move the pointer off the board', () =>
      this.campingMap.hexBoard.moveAwayFromBoard(),
    );
  }

  async verifyShowsItemIconAndTokenType(tokenType: RegExp): Promise<void> {
    await this.step(
      `Verify the hover card shows an item icon and the token type "${tokenType}"`,
      async () => {
        await this.campingMap.hexInfoTooltip.verifyIconIsShown();
        await this.campingMap.hexInfoTooltip.verifyTokenType(tokenType);
        await this.campingMap.hexInfoTooltip.verifyDividerFollowsLight();
      },
    );
  }

  async verifyShowsIconWithoutTokenType(): Promise<void> {
    await this.step('Verify the hover card shows an icon but no token type', async () => {
      await this.campingMap.hexInfoTooltip.verifyIconIsShown();
      await this.campingMap.hexInfoTooltip.verifyNoTokenType();
      await this.campingMap.hexInfoTooltip.verifyDividerHasNoLight();
    });
  }

  async verifyIsHidden(): Promise<void> {
    await this.step('Verify the hover card is gone', () =>
      this.campingMap.hexInfoTooltip.verifyIsHidden(),
    );
  }
}
