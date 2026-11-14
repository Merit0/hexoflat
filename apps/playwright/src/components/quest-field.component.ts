import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

const POLL = { timeout: 8_000, intervals: [100] };

export type QuestHex = { columnIndex: number; rowIndex: number };
export type QuestFieldHex = {
  hex: QuestHex;
  number: number | null;
  hint: boolean;
  footprint: boolean;
  step: { cost: number; back: boolean } | null;
};
export type QuestFieldSnapshot = {
  phase: string;
  outcome: string | null;
  position: QuestHex;
  path: number[];
  pathHexes: QuestHex[];
  hintHex: QuestHex | null;
  chest: QuestHex | null;
  stepCost: number;
  backCost: number;
  hexes: QuestFieldHex[];
};

/** The Treasure Seeker field drawn over the map (apps/web's quest-field-area.vue). */
export class QuestFieldComponent extends BaseComponent {
  private get field(): Locator {
    return this.page.getByTestId('quest-field');
  }

  private get canvas(): Locator {
    return this.field.locator('canvas');
  }

  async waitForReady(): Promise<void> {
    await expect(this.field).toHaveAttribute('data-ready', 'true', { timeout: 15_000 });
  }

  async verifyIsClosed(): Promise<void> {
    await expect(this.field).toHaveCount(0);
  }

  async read(): Promise<QuestFieldSnapshot> {
    const snapshot = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getQuestField());
    if (!snapshot) throw new Error('No quest run is open');
    return snapshot;
  }

  async verifyPathLength(length: number): Promise<void> {
    await expect.poll(async () => (await this.read()).path.length, POLL).toBe(length);
  }

  async verifyPhase(phase: string): Promise<void> {
    await expect.poll(async () => (await this.read()).phase, POLL).toBe(phase);
  }

  async verifyChestShown(): Promise<void> {
    await expect.poll(async () => (await this.read()).chest !== null, POLL).toBe(true);
  }

  async clickHex(hex: QuestHex): Promise<void> {
    const point = await this.page.evaluate(
      (target) => window.__HEXOFLAT_TEST__!.getQuestHexPoint(target.columnIndex, target.rowIndex),
      hex,
    );
    if (!point) throw new Error('The quest field has no camera yet');
    await this.canvas.click({ position: point });
  }

  async hoverHex(hex: QuestHex): Promise<void> {
    const point = await this.page.evaluate(
      (target) => window.__HEXOFLAT_TEST__!.getQuestHexPoint(target.columnIndex, target.rowIndex),
      hex,
    );
    if (!point) throw new Error('The quest field has no camera yet');
    await this.canvas.hover({ position: point });
  }

  async verifyTip(pattern: RegExp): Promise<void> {
    await expect(this.page.getByTestId('quest-hex-tip')).toHaveText(pattern);
  }
}
