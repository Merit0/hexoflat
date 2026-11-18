import { expect } from '@playwright/test';
import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import type { BagItemLook } from '@components/hero-inventory.component';

const TOKEN_SPRITE_DIR = '/hex-assets/items/';

export class TokenLookFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();
  private remembered: BagItemLook | null = null;

  async rememberBagItem(itemKey: string): Promise<void> {
    await this.step(
      `Remember the name, sprite and attributes of the "${itemKey}" in the bag`,
      async () => {
        this.remembered = await this.readLook(itemKey);
      },
    );
  }

  async verifyLookComesFromTheToken(itemKey: string, oldTitle: RegExp): Promise<void> {
    await this.step(
      'Verify the item is drawn and named from its token, not from the old item',
      async () => {
        const look = await this.readLook(itemKey);
        expect(look.sprite).toContain(TOKEN_SPRITE_DIR);
        expect(look.title).not.toMatch(oldTitle);
        expect(look.lines.length).toBeGreaterThan(0);
      },
    );
  }

  async verifyBagItemLooksTheSame(itemKey: string): Promise<void> {
    await this.step(
      `Verify the "${itemKey}" in the bag has the same name, sprite and attributes`,
      async () => {
        expect(await this.readLook(itemKey)).toEqual(this.requireRemembered());
      },
    );
  }

  private async readLook(itemKey: string): Promise<BagItemLook> {
    await this.campingMap.heroBoardPanel.clickTab('inventory');
    await this.campingMap.heroBoardPanel.verifyTabActive('inventory');
    const itemId = await this.campingMap.inventory.getItemIdByKey(itemKey);
    return this.campingMap.inventory.readGridItemLook(itemId);
  }

  private requireRemembered(): BagItemLook {
    if (!this.remembered) throw new Error('No item look was remembered before this check');
    return this.remembered;
  }
}
