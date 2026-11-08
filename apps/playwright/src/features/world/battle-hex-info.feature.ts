import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { BattleFlowFeature } from '@features/world/battle-flow.feature';

type Side = 'heroes' | 'enemies';

export class BattleHexInfoFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async startBattle(): Promise<void> {
    await new BattleFlowFeature().startBattleNextToTheSquad();
  }

  async hoverACreature(side: Side): Promise<void> {
    await this.step(`Hover a living creature of the ${side} side`, async () => {
      const snapshot = await this.campingMap.hexBoard.readBattleSnapshot();
      const creature = snapshot?.creatures.find((c) => c.side === side && c.hp > 0);
      if (!creature) throw new Error(`No living creature on the ${side} side.`);
      await this.hoverHex({ q: creature.q, r: creature.r });
    });
  }

  async hoverATerrain(terrain: string): Promise<void> {
    await this.step(`Hover a "${terrain}" hex`, async () => {
      const snapshot = await this.campingMap.hexBoard.readBattleSnapshot();
      const key = Object.keys(snapshot?.terrainByHex ?? {}).find(
        (hexKey) => snapshot?.terrainByHex[hexKey] === terrain,
      );
      if (!key) throw new Error(`The battlefield has no "${terrain}" hex.`);
      const [q, r] = key.split(',').map(Number);
      await this.hoverHex({ q, r });
    });
  }

  private async hoverHex(hex: { q: number; r: number }): Promise<void> {
    const point = await this.campingMap.hexBoard.battleHexPoint(hex);
    if (!point) throw new Error('The battle board did not report a point for the hex.');
    await this.campingMap.battleTab.hoverBoardPoint(point);
  }

  async verifyShowsTitle(title: RegExp): Promise<void> {
    await this.step(`Verify the battle hover card is titled "${title}"`, () =>
      this.campingMap.hexInfoTooltip.verifyTitle(title),
    );
  }

  async verifyShowsAnIcon(): Promise<void> {
    await this.step('Verify the battle hover card shows an icon on top', () =>
      this.campingMap.hexInfoTooltip.verifyIconIsShown(),
    );
  }

  async verifyShowsTheWarning(): Promise<void> {
    await this.step('Verify the battle hover card shows the warning', () =>
      this.campingMap.hexInfoTooltip.verifyEffectIsShown(),
    );
  }

  async verifyNoCard(): Promise<void> {
    await this.step('Verify no hover card is shown', () =>
      this.campingMap.hexInfoTooltip.verifyIsHidden(),
    );
  }
}
