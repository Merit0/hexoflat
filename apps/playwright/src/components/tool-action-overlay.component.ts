import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

/**
 * The floating tool-action bubble that follows the armed tool's hover target
 * (apps/web's tool-hex-tile.vue). Its single button is whatever action the
 * interactions resolver offers for the hovered hexobject — TAKE, CUT, ...
 */
export class ToolActionOverlayComponent extends BaseComponent {
  private get actionButton() {
    return this.page.getByTestId('tool-action-button');
  }

  async triggerAction(): Promise<void> {
    await this.actionButton.click();
  }

  async verifyActionIsOffered(): Promise<void> {
    await expect(this.actionButton).toBeVisible();
  }

  /**
   * The overlay stays open at the hero's hover after a successful pickup
   * (taking more items is still possible), but with nothing left on the tile
   * it must stop offering the action.
   */
  async verifyActionIsNoLongerOffered(): Promise<void> {
    await expect(this.actionButton).toBeHidden();
  }

  async verifyCostChip(cost: number): Promise<void> {
    await expect(this.page.getByTestId('tool-action-cost')).toContainText(String(cost));
  }

  async verifyActionIsAffordable(): Promise<void> {
    await expect(this.actionButton).toHaveAttribute('aria-disabled', 'false');
  }

  async verifyInsufficientWill(): Promise<void> {
    await expect(this.actionButton).toHaveAttribute('aria-disabled', 'true');
    await this.actionButton.click();
    await expect(this.page.getByTestId('action-alert-banner')).toContainText(
      /Недостатньо Волі|Not enough Will/,
    );
  }
}
