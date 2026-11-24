import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { EquipSlot } from '@config/equip-slot';
import { OpenCampingMapFeature } from './open-camping-map.feature';
import { SwitchHeroBoardTabFeature } from './switch-hero-board-tab.feature';
import { VerifyInventoryFeature } from './verify-inventory.feature';
import '@framework/test-api';

export class EquipmentYieldFeature extends BaseFeature {
  private readonly map = new CampingMapPage();
  private readonly tabs = new SwitchHeroBoardTabFeature();
  private readonly tokens = new Map<string, string>();
  private resource: 'tree' | 'rock' = 'tree';
  private questId = 'woodcutter';

  async start(tool: 'axe' | 'pickaxe', bonus: 1 | 2): Promise<void> {
    await this.step(`Start with a plain ${tool} and Yield +${bonus} in the bag`, async () => {
      await new OpenCampingMapFeature().open();
      this.resource = tool === 'axe' ? 'tree' : 'rock';
      this.questId = tool === 'axe' ? 'woodcutter' : 'stonebreaker';
      await this.givenTool('plain', tool, 0);
      await this.givenTool('bonus', tool, bonus);
      await this.page.evaluate(
        (questId) =>
          window.__HEXOFLAT_TEST__!.setQuests({
            active: [{ questId, progress: 0, state: 'active' }],
          }),
        this.questId,
      );
    });
  }

  async givenTool(name: string, tool: 'axe' | 'pickaxe', bonus: number): Promise<void> {
    await this.step(`Grant ${name}: ${tool} with Yield +${bonus}`, async () => {
      const token = await new VerifyInventoryFeature().givenTokenItem({
        type: tool,
        tokenType: 'idol',
        mapTier: bonus === 2 ? 3 : 1,
        attributes: bonus ? [{ key: 'yield', value: bonus }] : [],
      });
      this.tokens.set(name, token.id);
    });
  }

  async equip(name: string, slot = EquipSlot.WEAPON): Promise<void> {
    await this.step(`Equip the ${name} tool into ${slot} through Inventory`, async () => {
      await this.tabs.switchTo('inventory');
      const id = await this.itemId(name);
      await this.map.inventory.dragTokenToEquipSlot(id, slot);
      await this.tabs.switchTo('hero');
    });
  }

  async activate(name: string): Promise<void> {
    await this.step(`Activate the exact ${name} tool through Inventory USE`, async () => {
      await this.tabs.switchTo('inventory');
      await this.map.inventory.useEquippedItem(await this.itemId(name));
      await this.tabs.switchTo('hero');
    });
  }

  async startHarvest(name: string, bonus: number, wheel = false): Promise<void> {
    await this.step(`Start harvesting ${this.resource} with ${name}`, async () => {
      const at = await this.map.hexBoard.placeItemNextToHero(this.resource);
      if (wheel) await this.map.hexBoard.armHandTool();
      else await this.activate(name);
      await this.map.hexBoard.hoverTile(at);
      await this.map.toolActionOverlay.triggerAction();
      await this.map.equipmentYield.verifyPending(bonus);
    });
  }

  async harvest(name: string, bonus: number, total: number, questProgress: number): Promise<void> {
    await this.step(
      'Finish the real timed action and verify resource and quest counts',
      async () => {
        await this.startHarvest(name, bonus);
        await this.verify(total, questProgress);
      },
    );
  }

  async harvestWithWheel(bonus: number, total: number, questProgress: number): Promise<void> {
    await this.step(
      'Cycle to the other equipped tool with the mouse wheel and harvest',
      async () => {
        await this.startHarvest('the other hand', bonus, true);
        await this.verify(total, questProgress);
      },
    );
  }

  async verify(total: number, questProgress: number): Promise<void> {
    await this.step(`Verify ${total} resources and ${questProgress} quest progress`, () =>
      this.map.equipmentYield.verifyResources(this.resource, total, this.questId, questProgress),
    );
  }

  async reload(): Promise<void> {
    await this.step(
      'Reload the server-held inventory, pending work and quest progress',
      async () => {
        await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.settleInventorySync());
        await this.map.reload();
        await this.map.waitUntilReady();
      },
    );
  }

  private async itemId(name: string): Promise<string> {
    const token = this.tokens.get(name);
    if (!token) throw new Error(`Unknown tool ${name}`);
    const id = await this.page.evaluate(
      (tokenId) => window.__HEXOFLAT_TEST__!.getInventoryItemIdByTokenId(tokenId),
      token,
    );
    if (!id) throw new Error(`No owned item for ${name}`);
    return id;
  }
}
