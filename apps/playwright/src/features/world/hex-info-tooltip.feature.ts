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

  async hoverFirstHexWithKey(hexobjectKey: string): Promise<void> {
    await this.step(`Hover the first hex holding "${hexobjectKey}"`, async () => {
      const [first] = await this.campingMap.hexBoard.findTilesWithKey(hexobjectKey);
      if (!first) throw new Error(`No hex holds "${hexobjectKey}" on the camping map.`);
      await this.campingMap.hexBoard.hoverTileForInfo(first);
    });
  }

  async verifyShowsTitleAndKind(title: RegExp): Promise<void> {
    await this.step(`Verify the hover card shows "${title}" with its kind`, async () => {
      await this.campingMap.hexInfoTooltip.verifyTitle(title);
      await this.campingMap.hexInfoTooltip.verifyKindIsShown();
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

  async verifyShowsItemIconAndRarity(rarity: RegExp): Promise<void> {
    await this.step(
      `Verify the hover card shows an item icon and the rarity "${rarity}"`,
      async () => {
        await this.campingMap.hexInfoTooltip.verifyIconIsShown();
        await this.campingMap.hexInfoTooltip.verifyRarity(rarity);
        await this.campingMap.hexInfoTooltip.verifyDividerFollowsRarity();
      },
    );
  }

  async verifyHasNoIconAndNoRarity(): Promise<void> {
    await this.step('Verify the hover card has no item icon and no rarity', async () => {
      await this.campingMap.hexInfoTooltip.verifyNoIcon();
      await this.campingMap.hexInfoTooltip.verifyNoRarity();
      await this.campingMap.hexInfoTooltip.verifyDividerHasNoRarity();
    });
  }

  async verifyIsHidden(): Promise<void> {
    await this.step('Verify the hover card is gone', () =>
      this.campingMap.hexInfoTooltip.verifyIsHidden(),
    );
  }
}
