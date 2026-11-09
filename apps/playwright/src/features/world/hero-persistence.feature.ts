import { BaseFeature } from '@framework/base-feature';
import { setCurrentPage } from '@framework/test-context';
import { CampingMapPage } from '@pages/camping-map.page';
import { ReloadCampingMapFeature } from '@features/world/reload-camping-map.feature';
import { SwitchHeroBoardTabFeature } from '@features/world/switch-hero-board-tab.feature';
import { VerifyInventoryFeature } from '@features/world/verify-inventory.feature';

/** The hero's bag lives on the server: it survives a reload and ignores what the browser stores. */
export class HeroPersistenceFeature extends BaseFeature {
  async verifyNewHeroHasNothing(keys: string[]): Promise<void> {
    await this.step('Verify a brand-new hero holds nothing', async () => {
      await new SwitchHeroBoardTabFeature().switchTo('inventory');
      for (const key of keys) {
        await new VerifyInventoryFeature().verifyItemAmount(key, 0);
      }
    });
  }

  async receiveAndWaitUntilSaved(key: string, amount: number): Promise<void> {
    await this.step(`Receive ${amount} x "${key}" and wait until the server has it`, async () => {
      await this.page.evaluate(
        async ([itemKey, n]) => {
          window.__HEXOFLAT_TEST__!.grantInventoryItem(itemKey as string, n as number);
          await window.__HEXOFLAT_TEST__!.settleInventorySync();
        },
        [key, amount] as const,
      );
    });
  }

  async reload(): Promise<void> {
    await this.step('Reload the page', () => new ReloadCampingMapFeature().reload());
  }

  async verifyHolds(key: string, amount: number): Promise<void> {
    await this.step(`Verify the hero holds ${amount} x "${key}"`, async () => {
      await new SwitchHeroBoardTabFeature().switchTo('inventory');
      await new VerifyInventoryFeature().verifyItemAmount(key, amount);
    });
  }

  async forgeLocalInventory(key: string, amount: number): Promise<void> {
    await this.step(`Write ${amount} x "${key}" into the browser storage by hand`, () =>
      this.page.evaluate(
        ([itemKey, n]) => {
          const bag = {
            items: [
              {
                id: 'forged',
                key: itemKey,
                type: 'loot',
                stackKey: itemKey,
                amount: n,
                slotKey: 'r1c1',
                isNew: false,
              },
            ],
            rotationsById: {},
            carryCapacityKg: 999,
          };
          localStorage.setItem(
            'hexoflat:inventory:v2:hero',
            JSON.stringify({ version: 2, bag, stash: null }),
          );
          localStorage.setItem('hexoflat.hero.inventory.v1', JSON.stringify(bag));
        },
        [key, amount] as const,
      ),
    );
  }

  async takeTheHeroOverFromAnotherTab(): Promise<void> {
    await this.step('Open the game in a second tab, which takes the hero over', async () => {
      const first = this.page;
      const second = await first.context().newPage();
      setCurrentPage(second);
      try {
        const camping = new CampingMapPage();
        await camping.goto();
        await camping.waitUntilReady();
      } finally {
        setCurrentPage(first);
      }
    });
  }

  async verifyFirstTabIsToldItNoLongerSaves(): Promise<void> {
    await this.step('Verify the first tab knows the hero was taken over', () =>
      new CampingMapPage().inventory.verifyServerSessionIs('taken-over'),
    );
  }
}
