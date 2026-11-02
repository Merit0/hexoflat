import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

/** The BATTLE tab and the battle board laid over the map (battle-tab.vue, battle-board-area.vue). */
export class BattleTabComponent extends BaseComponent {
  async watchSprite(url: RegExp): Promise<() => Promise<void>> {
    const response = this.page.waitForResponse((r) => url.test(r.url()));
    return async () => {
      expect((await response).status()).toBe(200);
    };
  }

  async verifyTurnCost(cost: number): Promise<void> {
    await expect(this.page.getByTestId('battle-turn-cost-value')).toHaveText(String(cost));
  }

  async readTurnCost(): Promise<number> {
    const text = await this.page.getByTestId('battle-turn-cost-value').innerText();
    return Number(text);
  }

  async verifyCostTooHigh(tooHigh: boolean): Promise<void> {
    const panel = this.page.getByTestId('battle-turn-cost');
    if (tooHigh) await expect(panel).toHaveClass(/is-too-high/);
    else await expect(panel).not.toHaveClass(/is-too-high/);
  }

  async pressEndTurn(): Promise<void> {
    await this.page.getByTestId('battle-end-turn').click();
  }

  async pressUndo(): Promise<void> {
    await this.page.getByTestId('battle-undo').click();
  }

  async verifyEndTurnHidden(): Promise<void> {
    await expect(this.page.getByTestId('battle-end-turn')).toHaveCount(0);
  }

  async verifyInitiativeChips(count: number): Promise<void> {
    await expect(this.page.getByTestId(/^battle-init-chip-/)).toHaveCount(count);
  }

  async verifyBoardOpen(): Promise<void> {
    await expect(this.page.getByTestId('battle-board')).toBeVisible();
    await expect(this.page.getByTestId('battle-start')).toHaveCount(0);
  }

  async leaveBattle(): Promise<void> {
    await this.page.getByTestId('battle-leave').click();
  }

  async waitForBoardStill(): Promise<void> {
    await expect(this.page.getByTestId('battle-board')).toHaveAttribute('data-animating', 'false');
  }

  async verifyBoardClosed(): Promise<void> {
    await expect(this.page.getByTestId('battle-board-area')).toBeHidden();
    await expect(this.page.getByTestId('battle-tab')).toBeHidden();
  }

  private get toolHex() {
    return this.page.getByTestId('battle-tool-hex');
  }

  private get heroCard() {
    return this.page.getByTestId('battle-hero-controls');
  }

  private get canvas() {
    return this.page.getByTestId('battle-board').locator('canvas');
  }

  async verifyHeroCardState(state: 'defend' | 'aim' | 'act' | 'wait'): Promise<void> {
    await expect(this.heroCard).toHaveAttribute('data-state', state);
  }

  async verifyReactionTimerRunning(): Promise<void> {
    await expect(this.page.getByTestId('battle-reaction-timer')).toBeVisible();
  }

  async verifyWaitingForTheDefender(): Promise<void> {
    await expect(this.page.getByTestId('battle-wait-blocking')).toBeVisible();
  }

  async verifyYourTurnTag(visible: boolean): Promise<void> {
    const tag = this.page.getByTestId('battle-tag-your-turn');
    if (visible) await expect(tag).toBeVisible();
    else await expect(tag).toBeHidden();
  }

  async verifyNoStageBarAndNoBlockButton(): Promise<void> {
    await expect(this.page.getByTestId('battle-stage-bar')).toHaveCount(0);
    await expect(this.page.getByTestId('battle-block')).toHaveCount(0);
  }

  async takeHit(): Promise<void> {
    await this.page.getByTestId('battle-take-hit').click();
  }

  async verifyShieldCount(placed: number, capacity: number): Promise<void> {
    await expect(this.page.getByTestId('battle-shield-count')).toHaveText(
      `${placed} / ${capacity}`,
    );
  }

  async verifyToolHexOffers(label: RegExp): Promise<void> {
    await expect(this.toolHex.getByTestId('tool-action-button')).toHaveText(label);
  }

  async pressToolHexAction(): Promise<void> {
    await this.toolHex.getByTestId('tool-action-button').click();
  }

  async scrollTheHandsWithTheWheel(): Promise<void> {
    await this.page.getByTestId('battle-board-area').hover();
    await this.page.mouse.wheel(0, 100);
    await expect(this.page.getByTestId('battle-hand-right')).toBeVisible();
  }

  async hoverBoardPoint(point: { x: number; y: number }): Promise<void> {
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

  async verifyEnemySelected(id: string): Promise<void> {
    await expect(this.page.getByTestId(`battle-row-selected-${id}`)).toBeVisible();
  }

  async clickBoardPoint(point: { x: number; y: number }): Promise<void> {
    await this.canvas.click({ position: point });
  }
}
