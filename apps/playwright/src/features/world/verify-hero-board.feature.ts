import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import type {
  HeroBoardTab,
  HeroDetailsTab,
  HeroHand,
  HeroSkillId,
} from '@components/hero-board-panel.component';

export class VerifyHeroBoardFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async verifyStepsChanged(previous: string): Promise<void> {
    await this.step('Verify the steps counter changed', () =>
      this.campingMap.heroBoardPanel.verifyStepsTextChangedFrom(previous),
    );
  }

  async verifyPanelVisible(): Promise<void> {
    await this.step('Verify the hero board panel is visible', () =>
      this.campingMap.heroBoardPanel.verifyIsVisible(),
    );
  }

  async verifyTabActive(tab: HeroBoardTab): Promise<void> {
    await this.step(`Verify the "${tab}" tab is active`, () =>
      this.campingMap.heroBoardPanel.verifyTabActive(tab),
    );
  }

  async verifyTabNotActive(tab: HeroBoardTab): Promise<void> {
    await this.step(`Verify the "${tab}" tab is not active`, () =>
      this.campingMap.heroBoardPanel.verifyTabNotActive(tab),
    );
  }

  async verifyHeroTabContentVisible(): Promise<void> {
    await this.step('Verify the Hero tab content is visible', () =>
      this.campingMap.heroBoardPanel.verifyHeroTabContentVisible(),
    );
  }

  async verifyHeroTabContentHidden(): Promise<void> {
    await this.step('Verify the Hero tab content is hidden', () =>
      this.campingMap.heroBoardPanel.verifyHeroTabContentHidden(),
    );
  }

  async verifyPanelOpen(): Promise<void> {
    await this.step('Verify the hero board panel is open', () =>
      this.campingMap.heroBoardPanel.verifyPanelOpen(),
    );
  }

  async verifyPanelCollapsed(): Promise<void> {
    await this.step('Verify the hero board panel is collapsed', () =>
      this.campingMap.heroBoardPanel.verifyPanelCollapsed(),
    );
  }

  async openHeroTabFromHeroHex(): Promise<void> {
    await this.step('Click the hero hex in the equipment board to open the Hero tab', async () => {
      await this.campingMap.heroBoardPanel.clickTab('inventory');
      await this.campingMap.inventory.clickHeroHex();
      await this.campingMap.heroBoardPanel.verifyTabActive('hero');
    });
  }

  async switchDetailsTab(tab: HeroDetailsTab): Promise<void> {
    await this.step(`Switch the hero details to "${tab}"`, async () => {
      await this.campingMap.heroBoardPanel.clickDetailsTab(tab);
      await this.campingMap.heroBoardPanel.verifyDetailsTabPressed(tab);
    });
  }

  async verifyScoutPathCardVisible(): Promise<void> {
    await this.step('Verify the Scout path card is shown instead of the state list', () =>
      this.campingMap.heroBoardPanel.verifyScoutPathCardVisible(),
    );
  }

  async unlockSkill(id: HeroSkillId, expectedRank: number): Promise<void> {
    await this.step(`Unlock the "${id}" skill with Will up to rank ${expectedRank}`, async () => {
      await this.campingMap.heroBoardPanel.unlockSkill(id);
      await this.campingMap.heroBoardPanel.verifySkillRank(id, expectedRank, 10);
    });
  }

  async verifySkillCannotBeUnlocked(id: HeroSkillId): Promise<void> {
    await this.step(`Verify the "${id}" skill cannot be unlocked with the Will left`, () =>
      this.campingMap.heroBoardPanel.verifySkillCannotBeUnlocked(id),
    );
  }

  async verifySkillTreeVisible(): Promise<void> {
    await this.step('Verify the skill tree is shown on the Path tab', () =>
      this.campingMap.heroBoardPanel.verifySkillTreeVisible(),
    );
  }

  async verifyHeartsMatchHealth(): Promise<void> {
    await this.step('Verify the hearts show the hero health', () =>
      this.campingMap.heroBoardPanel.verifyHeartsMatchHealth(),
    );
  }

  async verifyHandEmpty(hand: HeroHand): Promise<void> {
    await this.step(`Verify the ${hand} hand is empty`, () =>
      this.campingMap.heroBoardPanel.verifyHandEmpty(hand),
    );
  }

  async verifyHandHolds(hand: HeroHand, name: RegExp): Promise<void> {
    await this.step(`Verify the ${hand} hand holds ${name}`, () =>
      this.campingMap.heroBoardPanel.verifyHandHolds(hand, name),
    );
  }

  async readAttackTileText(): Promise<string> {
    return this.step('Read the attack tile', () =>
      this.campingMap.heroBoardPanel.readAttackTileText(),
    );
  }

  async verifyAttackTileChangedFrom(previous: string): Promise<void> {
    await this.step('Verify the attack tile changed', () =>
      this.campingMap.heroBoardPanel.verifyAttackTileChangedFrom(previous),
    );
  }
}
