import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';
import type { EquipSlot } from '@config/equip-slot';

const INVENTORY_POLL_TIMEOUT_MS = 5_000;
const POLL_INTERVALS_MS = [100];
const DRAG_MOVE_STEPS = 8;

/** The always-mounted hero board panel (apps/web's hero-board-panel.vue). */
export class HeroInventoryComponent extends BaseComponent {
  private get panel(): Locator {
    return this.page.getByTestId('hero-board-panel');
  }

  private gridToken(itemId: string): Locator {
    return this.page.getByTestId(`inventory-token-${itemId}`);
  }

  private gridCell(slotKey: string): Locator {
    return this.page.getByTestId(`inventory-cell-${slotKey}`);
  }

  private equipToken(itemId: string): Locator {
    return this.page.getByTestId(`equip-token-${itemId}`);
  }

  private equipSlot(slot: EquipSlot): Locator {
    return this.page.getByTestId(`equip-slot-${slot}`);
  }

  async getItemKeys(): Promise<string[]> {
    return this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getInventoryItemKeys());
  }

  async getItemIdByKey(itemKey: string): Promise<string> {
    const id = await this.page.evaluate(
      (key) => window.__HEXOFLAT_TEST__!.getInventoryItemIdByKey(key),
      itemKey,
    );
    if (!id) throw new Error(`No carried item with key "${itemKey}" — was it picked up yet?`);
    return id;
  }

  /**
   * TAKE starts as a pending action finished by the 250ms world tick loop
   * (world-map-store.ts's startWorldLoop), so the inventory update is not
   * instant.
   */
  async verifyContainsItem(itemKey: string): Promise<void> {
    await expect
      .poll(() => this.getItemKeys(), {
        timeout: INVENTORY_POLL_TIMEOUT_MS,
        intervals: POLL_INTERVALS_MS,
      })
      .toContain(itemKey);
  }

  async verifyItemAmount(itemKey: string, amount: number): Promise<void> {
    await expect
      .poll(
        () =>
          this.page.evaluate(
            (key) => window.__HEXOFLAT_TEST__!.getInventoryItemAmount(key),
            itemKey,
          ),
        { timeout: INVENTORY_POLL_TIMEOUT_MS, intervals: POLL_INTERVALS_MS },
      )
      .toBe(amount);
  }

  async verifyDoesNotContainItem(itemKey: string): Promise<void> {
    expect(await this.getItemKeys()).not.toContain(itemKey);
  }

  async verifyIsVisible(): Promise<void> {
    await expect(this.panel).toBeVisible();
  }

  async dragTokenToGridSlot(itemId: string, targetSlotKey: string): Promise<void> {
    await this.dragBetween(this.gridToken(itemId), this.gridCell(targetSlotKey));
  }

  async dragTokenToEquipSlot(itemId: string, slot: EquipSlot): Promise<void> {
    await this.dragBetween(this.gridToken(itemId), this.equipSlot(slot));
  }

  async dragEquippedItemToGridSlot(itemId: string, targetSlotKey: string): Promise<void> {
    await this.dragBetween(this.equipToken(itemId), this.gridCell(targetSlotKey));
  }

  private async dragBetween(source: Locator, target: Locator): Promise<void> {
    await expect(source).toBeVisible();
    const [sourceBox, targetBox] = await Promise.all([source.boundingBox(), target.boundingBox()]);
    if (!sourceBox || !targetBox) {
      throw new Error('dragBetween: source or target has no bounding box (not visible/rendered).');
    }

    const from = {
      x: sourceBox.x + sourceBox.width / 2,
      y: sourceBox.y + sourceBox.height / 2,
    };
    const to = {
      x: targetBox.x + targetBox.width / 2,
      y: targetBox.y + targetBox.height / 2,
    };

    await this.page.mouse.move(from.x, from.y);
    await this.page.mouse.down();

    for (let step = 1; step <= DRAG_MOVE_STEPS; step += 1) {
      const t = step / DRAG_MOVE_STEPS;
      await this.page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
    }

    await this.page.mouse.up();
  }

  async verifyItemInGridSlot(itemId: string, slotKey: string): Promise<void> {
    await expect(this.gridCell(slotKey).getByTestId(`inventory-token-${itemId}`)).toBeVisible();
  }

  async verifyItemEquipped(itemId: string, slot: EquipSlot): Promise<void> {
    await expect(this.equipSlot(slot).getByTestId(`equip-token-${itemId}`)).toBeVisible();
  }

  private async getWillSlotKey(): Promise<string> {
    return this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getWillSlotKey());
  }

  async verifyWillTokenInItsCell(): Promise<void> {
    const cell = this.gridCell(await this.getWillSlotKey());
    const token = cell.getByTestId('inventory-will-token');
    await expect(token).toBeVisible();
    await expect
      .poll(async () => {
        const current = await this.page.evaluate(
          () => window.__HEXOFLAT_TEST__!.getKnowledge()?.current,
        );
        return (
          (await cell.getByTestId('inventory-will-amount').textContent())?.trim() ===
          String(current)
        );
      })
      .toBe(true);
  }

  async verifyWillCellHoldsNoItem(): Promise<void> {
    const cell = this.gridCell(await this.getWillSlotKey());
    await expect(cell.locator('[data-testid^="inventory-token-"]')).toHaveCount(0);
  }

  async dragTokenToWillCell(itemId: string): Promise<void> {
    await this.dragBetween(this.gridToken(itemId), this.gridCell(await this.getWillSlotKey()));
  }

  async verifyWillTooltipOnHover(): Promise<void> {
    await this.gridCell(await this.getWillSlotKey()).hover();
    await expect(this.page.getByTestId('inventory-will-tooltip')).toBeVisible();
  }

  async verifyItemStaysInGridSlot(itemId: string, slotKey: string): Promise<void> {
    await this.verifyItemInGridSlot(itemId, slotKey);
  }

  async clickHeroHex(): Promise<void> {
    await this.page.getByTestId('equip-hero-slot').click();
  }

  private get tooltip(): Locator {
    return this.page.getByTestId('item-tooltip');
  }

  async useEquippedItem(itemId: string): Promise<void> {
    await this.moveMouseAway();
    await this.equipToken(itemId).hover();
    await this.page.getByTestId(`equip-token-use-button-${itemId}`).click();
  }

  async hoverGridItem(itemId: string): Promise<void> {
    await this.moveMouseAway();
    await this.gridToken(itemId).hover();
  }

  async hoverEquippedItem(itemId: string): Promise<void> {
    await this.moveMouseAway();
    await this.equipToken(itemId).hover();
  }

  async moveMouseAway(): Promise<void> {
    await this.page.mouse.move(4, 4);
  }

  async verifyTooltipTitle(title: RegExp): Promise<void> {
    await expect(this.tooltip).toBeVisible();
    await expect(this.page.getByTestId('item-tooltip-title')).toHaveText(title);
  }

  async verifyTooltipMarkedEquipped(): Promise<void> {
    await expect(this.page.getByTestId('item-tooltip-equipped')).toBeVisible();
  }

  async verifyTooltipHidden(): Promise<void> {
    await expect(this.tooltip).toBeHidden();
  }
}
