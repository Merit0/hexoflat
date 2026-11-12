import { expect } from '@playwright/test';
import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { QuestBoardFeature } from '@features/world/quest-board.feature';
import { ReloadCampingMapFeature } from '@features/world/reload-camping-map.feature';
import type { QuestFieldHex, QuestFieldSnapshot } from '@components/quest-field.component';

const FIRST_TRAIL = 'seeker-1';

export class QuestRunFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();
  readonly board = new QuestBoardFeature();

  private get field() {
    return this.campingMap.questField;
  }

  private get panel() {
    return this.campingMap.questBoard;
  }

  async openBoard(): Promise<void> {
    await this.board.open();
  }

  async startFirstTrail(): Promise<void> {
    await this.step('Start the First Trail', async () => {
      await this.panel.start(FIRST_TRAIL);
      await this.field.waitForReady();
      await this.panel.verifyRunCard();
    });
  }

  async stepOnTrail(): Promise<void> {
    await this.step('Step to the hex that continues the numbers', async () => {
      const before = await this.field.read();
      const expected = before.path.length + 1;
      const target = this.forward(before).find((cell) => cell.number === expected);
      if (!target) throw new Error(`No reachable hex shows ${expected}`);
      await this.field.clickHex(target.hex);
      await this.field.verifyPathLength(before.path.length + 1);
    });
  }

  async stepOnTrailUntilStranded(): Promise<void> {
    await this.step('Take the step that spends the last Will', async () => {
      const before = await this.field.read();
      const target = this.forward(before).find((cell) => cell.number === before.path.length + 1);
      if (!target) throw new Error('No reachable hex continues the numbers');
      await this.field.clickHex(target.hex);
    });
  }

  async walkOnTrail(count: number): Promise<void> {
    await this.step(`Walk ${count} steps along the numbers`, async () => {
      for (let done = 0; done < count; done += 1) await this.stepOnTrail();
    });
  }

  async stepOffTrail(): Promise<void> {
    await this.step('Step to a hex that breaks the numbers', async () => {
      const before = await this.field.read();
      const expected = before.path.length + 1;
      const target = this.forward(before).find((cell) => cell.number !== expected);
      if (!target) throw new Error('No wrong hex to step on');
      await this.field.clickHex(target.hex);
      await this.field.verifyPathLength(before.path.length + 1);
    });
  }

  async stepOnAnyFreshHex(): Promise<void> {
    await this.step('Step to any hex not walked before', async () => {
      const before = await this.field.read();
      const walked = new Set(before.pathHexes.map((hex) => `${hex.columnIndex}:${hex.rowIndex}`));
      const target = this.forward(before).find(
        (cell) => !cell.footprint && !walked.has(`${cell.hex.columnIndex}:${cell.hex.rowIndex}`),
      );
      if (!target) throw new Error('Nothing to step on');
      await this.field.clickHex(target.hex);
      await this.field.verifyPathLength(before.path.length + 1);
    });
  }

  async stepOnAnyFreshHexUntilTheChestAppears(): Promise<void> {
    await this.step('Keep stepping on fresh hexes until a chest appears', async () => {
      for (let guard = 0; guard < 12; guard += 1) {
        if ((await this.field.read()).chest) return;
        await this.stepOnAnyFreshHex();
      }
      await this.field.verifyChestShown();
    });
  }

  async stepBack(): Promise<void> {
    await this.step('Step back to the previous hex', async () => {
      const before = await this.field.read();
      const target = before.hexes.find((cell) => cell.step?.back);
      if (!target) throw new Error('No step back is offered');
      await this.field.clickHex(target.hex);
      await this.field.verifyPathLength(before.path.length - 1);
    });
  }

  async openChest(): Promise<void> {
    await this.step('Open the chest that appeared', async () => {
      await this.field.verifyChestShown();
      const { chest } = await this.field.read();
      if (!chest) throw new Error('No chest on the field');
      await this.field.clickHex(chest);
    });
  }

  async verifyPhase(phase: string): Promise<void> {
    await this.step(`Verify the run is in the ${phase} phase`, async () => {
      await this.field.verifyPhase(phase);
      await this.panel.verifyRunPhase(phase);
    });
  }

  async verifyChestShown(): Promise<void> {
    await this.step('Verify the chest is on the field', () => this.field.verifyChestShown());
  }

  async verifyStepCounter(step: number, total: number): Promise<void> {
    await this.step(`Verify the counter reads ${step} / ${total}`, () =>
      this.panel.verifyRunStep(new RegExp(`${step}\\s*/\\s*${total}`)),
    );
  }

  async verifyTrailRow(): Promise<void> {
    await this.step('Verify the trail row matches the walked numbers', async () => {
      await this.panel.verifyTrail((await this.field.read()).path);
    });
  }

  async verifyHintOnFirstStep(): Promise<void> {
    await this.step('Verify one hex glows gold at the start', async () => {
      const field = await this.field.read();
      expect(field.hintHex).not.toBeNull();
      expect(field.hexes.filter((cell) => cell.hint)).toHaveLength(1);
    });
  }

  async verifyExactlyOneHexContinues(): Promise<void> {
    await this.step('Verify exactly one reachable hex continues the numbers', async () => {
      const field = await this.field.read();
      const expected = field.path.length + 1;
      const matching = this.forward(field).filter((cell) => cell.number === expected);
      expect(matching).toHaveLength(1);
    });
  }

  async verifyStepPrices(stepCost: number, backCost: number): Promise<void> {
    await this.step(`Verify steps cost ${stepCost} and a step back ${backCost}`, async () => {
      const field = await this.field.read();
      expect(field.stepCost).toBe(stepCost);
      expect(field.backCost).toBe(backCost);
    });
  }

  async hoverStepAndVerifyPrice(price: number): Promise<void> {
    await this.step(`Hover a reachable hex and see the price ${price}`, async () => {
      const target = this.forward(await this.field.read())[0];
      await this.field.hoverHex(target.hex);
      await this.field.verifyTip(new RegExp(String(price)));
    });
  }

  async verifyFieldGone(): Promise<void> {
    await this.step('Verify the quest field is gone', async () => {
      await this.field.verifyIsClosed();
      await this.panel.verifyRunGone();
    });
  }

  async returnToCamp(): Promise<void> {
    await this.step('Return to camp', async () => {
      await this.panel.returnToCamp();
      await this.panel.verifyResult('treasure');
    });
  }

  async giveUp(): Promise<void> {
    await this.step('Give up and confirm', async () => {
      await this.panel.giveUp();
      await this.panel.verifyResult('left');
    });
  }

  async verifyResult(outcome: string): Promise<void> {
    await this.step(`Verify the result card says ${outcome}`, () =>
      this.panel.verifyResult(outcome),
    );
  }

  async dismissResult(): Promise<void> {
    await this.step('Dismiss the result card', async () => {
      await this.panel.dismissResult();
      await this.field.verifyIsClosed();
    });
  }

  async setWill(will: number): Promise<void> {
    await this.step(`Set the hero's Will to ${will}`, async () => {
      await this.page.evaluate((value) => window.__HEXOFLAT_TEST__!.setWill(value), will);
      await this.board.verifyWill(will);
    });
  }

  async snapshotOfTheStart(): Promise<string> {
    return this.step('Remember how the field looks at the start', async () => {
      const field = await this.field.read();
      return JSON.stringify(field.hexes.map((cell) => [cell.hex, cell.number]));
    });
  }

  async verifyStartDiffersFrom(previous: string): Promise<void> {
    await this.step('Verify this field differs from the previous run', async () => {
      const field = await this.field.read();
      expect(JSON.stringify(field.hexes.map((cell) => [cell.hex, cell.number]))).not.toBe(previous);
    });
  }

  async reloadMidRun(): Promise<QuestFieldSnapshot> {
    return this.step('Reload the page in the middle of the run', async () => {
      const before = await this.field.read();
      await new ReloadCampingMapFeature().reload();
      await this.field.waitForReady();
      const after = await this.field.read();
      expect(after.phase).toBe(before.phase);
      expect(after.path).toEqual(before.path);
      expect(after.position).toEqual(before.position);
      expect(after.chest).toEqual(before.chest);
      expect(after.hexes.map((cell) => [cell.hex, cell.number])).toEqual(
        before.hexes.map((cell) => [cell.hex, cell.number]),
      );
      return after;
    });
  }

  private forward(field: QuestFieldSnapshot): QuestFieldHex[] {
    return field.hexes.filter((cell) => cell.step && !cell.step.back && cell.number !== null);
  }
}
