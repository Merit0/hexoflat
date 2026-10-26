import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import type {
  HeroBoardTab,
  HeroDetailsTab,
  HeroHand,
  HeroSkillId,
  SacrificeOption,
} from '@components/hero-board-panel.component';

import '@framework/test-api';

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

  async selectSkill(id: HeroSkillId): Promise<void> {
    await this.step(`Select the "${id}" skill node`, () =>
      this.campingMap.heroBoardPanel.selectSkill(id),
    );
  }

  async sacrificeToSkill(
    id: HeroSkillId,
    option: SacrificeOption,
    expectedRank: number,
  ): Promise<void> {
    await this.step(
      `Sacrifice Will (${option}) into "${id}" up to rank ${expectedRank}`,
      async () => {
        await this.campingMap.heroBoardPanel.selectSkill(id);
        await this.campingMap.heroBoardPanel.sacrifice(option);
        await this.campingMap.heroBoardPanel.verifySkillNodeRank(id, expectedRank);
      },
    );
  }

  async verifySacrificeUnavailable(id: HeroSkillId): Promise<void> {
    await this.step(`Verify no sacrifice into "${id}" is possible`, async () => {
      await this.campingMap.heroBoardPanel.selectSkill(id);
      for (const option of ['small', 'medium', 'all'] as const) {
        await this.campingMap.heroBoardPanel.verifySacrificeDisabled(option);
      }
    });
  }

  async verifySelectedSkillProgress(progress: number, cost: number): Promise<void> {
    await this.step(`Verify the selected skill bar shows ${progress}/${cost}`, () =>
      this.campingMap.heroBoardPanel.verifySelectedSkillProgress(progress, cost),
    );
  }

  async verifySkillProgress(id: HeroSkillId, progress: number, cost: number): Promise<void> {
    await this.step(`Verify "${id}" keeps ${progress}/${cost}`, async () => {
      await this.campingMap.heroBoardPanel.selectSkill(id);
      await this.campingMap.heroBoardPanel.verifySelectedSkillProgress(progress, cost);
    });
  }

  async verifySkillNodeRankIs(id: HeroSkillId, rank: number): Promise<void> {
    await this.step(`Verify "${id}" is at rank ${rank}`, () =>
      this.campingMap.heroBoardPanel.verifySkillNodeRank(id, rank),
    );
  }

  async verifySkillTreeWill(will: number): Promise<void> {
    await this.step(`Verify the skill tree shows ${will} Will`, () =>
      this.campingMap.heroBoardPanel.verifySkillTreeWill(will),
    );
  }

  async grantSkillRank(id: HeroSkillId, rank: number): Promise<void> {
    await this.step(`Grant "${id}" rank ${rank} through the test hook`, () =>
      this.page.evaluate(
        ([skill, value]) =>
          window.__HEXOFLAT_TEST__!.setSkillRank(skill as string, value as number),
        [id, rank],
      ),
    );
  }

  async resetAllSkills(): Promise<void> {
    await this.step('Reset all skills and confirm', () =>
      this.campingMap.heroBoardPanel.resetAllSkills(),
    );
  }

  async verifyResetUnavailable(): Promise<void> {
    await this.step('Verify there is nothing to reset', () =>
      this.campingMap.heroBoardPanel.verifyResetDisabled(),
    );
  }

  async verifySelectedSkill(name: RegExp, rank: number, maxRank: number): Promise<void> {
    await this.step(`Verify the selected skill is ${name} at rank ${rank}/${maxRank}`, async () => {
      await this.campingMap.heroBoardPanel.verifySelectedSkillName(name);
      await this.campingMap.heroBoardPanel.verifySelectedSkillRank(rank, maxRank);
    });
  }

  async verifySkillWaitsForParents(id: HeroSkillId, parents: RegExp): Promise<void> {
    await this.step(`Verify "${id}" is locked behind ${parents}`, async () => {
      await this.campingMap.heroBoardPanel.selectSkill(id);
      await this.campingMap.heroBoardPanel.verifySelectedSkillRequirementsShown(parents);
      await this.campingMap.heroBoardPanel.verifySacrificeDisabled('all');
    });
  }

  async verifySkillIsComingSoon(id: HeroSkillId): Promise<void> {
    await this.step(`Verify "${id}" is shown but not available yet`, async () => {
      await this.campingMap.heroBoardPanel.selectSkill(id);
      await this.campingMap.heroBoardPanel.verifySelectedSkillRequirementsHidden();
      await this.campingMap.heroBoardPanel.verifySacrificeHidden();
    });
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

  async emptyHandByIcon(hand: HeroHand): Promise<void> {
    await this.step(`Click the ${hand} hand icon to empty the hand`, async () => {
      await this.campingMap.heroBoardPanel.clickHandIcon(hand);
      await this.campingMap.heroBoardPanel.verifyHandEmpty(hand);
      await this.campingMap.heroBoardPanel.verifyHandIconDisabled(hand);
    });
  }

  async verifyHandWillCost(hand: HeroHand, will: number | null): Promise<void> {
    await this.step(`Verify the ${hand} hand shows ${will ?? 'no'} Will cost`, () =>
      this.campingMap.heroBoardPanel.verifyHandWillCost(hand, will),
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
