import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

export interface CollectGrave {
  q: number;
  r: number;
  examined: boolean;
  standHexes: { q: number; r: number }[];
}

export interface CollectItem {
  q: number;
  r: number;
  itemKey: string;
  amount: number;
  standHexes: { q: number; r: number }[];
}

export interface CollectSnapshot {
  collecting: boolean;
  outcome: string | null;
  lootLeft: boolean;
  heroHex: { q: number; r: number } | null;
  graves: CollectGrave[];
  items: CollectItem[];
}

const SETTLE_TIMEOUT_MS = 15_000;

/**
 * The collection phase after a won battle: graves, loot lying on the field, the exit confirmation.
 * State comes from `window.__HEXOFLAT_TEST__.getBattleCollect`; the only locators are the tool hex,
 * the canvas and the leave controls.
 */
export class BattleCollectComponent extends BaseComponent {
  private get toolHex() {
    return this.page.getByTestId('battle-tool-hex');
  }

  private get canvas() {
    return this.page.getByTestId('battle-board').locator('canvas');
  }

  async read(): Promise<CollectSnapshot> {
    const snapshot = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getBattleCollect());
    if (!snapshot) throw new Error('No battle is open.');
    return snapshot;
  }

  async waitForCollecting(): Promise<void> {
    await expect
      .poll(async () => (await this.read()).collecting, { timeout: SETTLE_TIMEOUT_MS })
      .toBe(true);
  }

  async waitForBoardStill(): Promise<void> {
    await expect(this.page.getByTestId('battle-board')).toHaveAttribute('data-animating', 'false', {
      timeout: SETTLE_TIMEOUT_MS,
    });
  }

  async pointOf(hex: { q: number; r: number }): Promise<{ x: number; y: number }> {
    const point = await this.page.evaluate(
      (target) => window.__HEXOFLAT_TEST__!.getBattleHexPoint(target.q, target.r),
      hex,
    );
    if (!point) throw new Error(`Hex ${hex.q},${hex.r} is not on the battle board.`);
    return point;
  }

  async clickHex(hex: { q: number; r: number }): Promise<void> {
    await this.canvas.click({ position: await this.pointOf(hex) });
  }

  async clickFirstUncoveredHex(
    hexes: { q: number; r: number }[],
  ): Promise<{ q: number; r: number }> {
    for (const hex of hexes) {
      const point = await this.pointOf(hex);
      if (await this.toolHexCovers(point)) continue;
      await this.canvas.click({ position: point });
      return hex;
    }
    throw new Error('Every hex beside the target is covered by the tool hex.');
  }

  async leaveConfirmingIfAsked(): Promise<void> {
    await this.page.getByTestId('battle-leave').click();
    const confirm = this.page.getByTestId('battle-leave-confirm');
    if (await confirm.isVisible()) await confirm.click();
  }

  async hoverHex(hex: { q: number; r: number }): Promise<void> {
    const point = await this.pointOf(hex);
    if (await this.toolHexCovers(point)) return;
    await this.canvas.hover({ position: point });
  }

  private async toolHexCovers(point: { x: number; y: number }): Promise<boolean> {
    if ((await this.toolHex.count()) === 0) return false;
    const canvas = await this.canvas.boundingBox();
    const tool = await this.toolHex.boundingBox();
    if (!canvas || !tool) return false;
    const x = canvas.x + point.x;
    const y = canvas.y + point.y;
    return x >= tool.x && x <= tool.x + tool.width && y >= tool.y && y <= tool.y + tool.height;
  }

  async openTheHandTool(): Promise<void> {
    if ((await this.toolHex.count()) === 0) {
      await this.page.getByTestId('battle-board-area').hover();
      await this.page.mouse.wheel(0, 100);
    }
    await expect(this.toolHex).toBeVisible();
  }

  async verifyToolOffers(label: RegExp): Promise<void> {
    await expect(this.toolHex.getByTestId('tool-action-button')).toHaveAttribute(
      'aria-label',
      label,
    );
  }

  async pressToolAction(): Promise<void> {
    await this.toolHex.getByTestId('tool-action-button').click();
  }

  async verifyHeroStandsAt(hex: { q: number; r: number }): Promise<void> {
    await expect
      .poll(async () => (await this.read()).heroHex, { timeout: SETTLE_TIMEOUT_MS })
      .toEqual(hex);
  }

  async verifyExamined(hex: { q: number; r: number }, examined: boolean): Promise<void> {
    await expect
      .poll(
        async () =>
          (await this.read()).graves.find((g) => g.q === hex.q && g.r === hex.r)?.examined ?? null,
        { timeout: SETTLE_TIMEOUT_MS },
      )
      .toBe(examined);
  }

  async verifyItemGone(hex: { q: number; r: number }): Promise<void> {
    await expect
      .poll(async () => (await this.read()).items.some((i) => i.q === hex.q && i.r === hex.r), {
        timeout: SETTLE_TIMEOUT_MS,
      })
      .toBe(false);
  }

  async bagTotals(): Promise<Record<string, number>> {
    const bag = await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getBag());
    const totals: Record<string, number> = {};
    for (const cell of bag) {
      if (!cell) continue;
      totals[cell.key] = (totals[cell.key] ?? 0) + cell.amount;
    }
    return totals;
  }

  async verifyLeaveWarningShown(shown: boolean): Promise<void> {
    await expect(this.page.getByTestId('battle-leave-warning')).toHaveCount(shown ? 1 : 0);
  }

  async pressLeave(): Promise<void> {
    await this.page.getByTestId('battle-leave').click();
  }

  async confirmLeave(): Promise<void> {
    await this.page.getByTestId('battle-leave-confirm').click();
  }

  async cancelLeave(): Promise<void> {
    await this.page.getByTestId('battle-leave-cancel').click();
  }
}
