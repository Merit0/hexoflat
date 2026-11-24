import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import type { TestItemToken } from '@framework/test-api';
import { OpenCampingMapFeature } from './open-camping-map.feature';
import { OpenShopFeature } from './open-shop.feature';

export class UniqueBuybackFeature extends BaseFeature {
  private readonly map = new CampingMapPage();
  private token: TestItemToken | null = null;
  private coinsBefore = 0;
  private salePrice = 0;

  async openStallWithUnique(uniqueKey: string): Promise<void> {
    await this.step(`Open the stall with the unique "${uniqueKey}" in the bag`, async () => {
      await new OpenCampingMapFeature().open();
      this.token = await this.page.evaluate(
        (key) => window.__HEXOFLAT_TEST__!.grantUniqueTokenItem(key),
        uniqueKey,
      );
      await new OpenShopFeature().open();
      this.coinsBefore = await this.map.shopBoard.readWalletCoins();
    });
  }

  async verifySectionHidden(): Promise<void> {
    await this.step('Verify the trader shows no unique to buy back', () =>
      this.map.shopBoard.verifyUniqueBuybackHidden(),
    );
  }

  async sell(): Promise<void> {
    await this.step('Sell the unique to the trader', async () => {
      const token = this.requireToken();
      await this.map.shopBoard.rightClickBagItem(token.type);
      await this.map.shopBoard.verifyUniqueBuybackHolds(token);
      this.salePrice = (await this.map.shopBoard.readWalletCoins()) - this.coinsBefore;
    });
  }

  async verifyOfferedForTheSalePrice(): Promise<void> {
    await this.step('Verify the same instance is offered for the coins of the sale', () =>
      this.map.shopBoard.verifyUniqueBuybackShows(
        String(this.requireToken().instanceId),
        this.salePrice,
      ),
    );
  }

  async reopenAfterReload(): Promise<void> {
    await new OpenShopFeature().openAfterReload();
  }

  async buyBack(): Promise<void> {
    await this.step('Buy the unique back', () => this.map.shopBoard.buyBackUnique(0));
  }

  async verifyOwnedAgain(): Promise<void> {
    await this.step('Verify the hero owns the identical instance and the same coins', async () => {
      await this.map.dimensionItems.verifyTokenUnchanged(this.requireToken());
      await this.map.shopBoard.verifyWalletCoins(this.coinsBefore);
    });
  }

  private requireToken(): TestItemToken {
    if (!this.token) throw new Error('No unique arranged');
    return this.token;
  }
}
