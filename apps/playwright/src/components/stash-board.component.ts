import { expect, type Locator } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

const POLL = { timeout: 5_000, intervals: [100] };
const DRAG_MOVE_STEPS = 8;

export type StashCellContent = { key: string; amount: number } | null;
export type StashTabState = 'owned' | 'locked';
export type StashFilterId = 'all' | 'gear' | 'tool' | 'resource' | 'consumable';

/**
 * The camp stash board that replaces the hero panel after OPEN on the Stash Chest
 * (apps/web's stash-board.vue). Stored state is read through the app's test hooks;
 * drags use the real pointer path.
 */
export class StashBoardComponent extends BaseComponent {
  private get board(): Locator {
    return this.page.getByTestId('stash-board');
  }

  private bagCellWith(itemKey: string): Locator {
    return this.page
      .locator(`[data-testid^="stash-bag-cell-"][data-item-key="${itemKey}"]`)
      .first();
  }

  private get freeBagCell(): Locator {
    return this.page.locator('[data-testid^="stash-bag-cell-"]:not([data-item-key])').first();
  }

  private stashCell(index: number): Locator {
    return this.page.getByTestId(`stash-cell-${index}`);
  }

  private tab(chest: number): Locator {
    return this.page.getByTestId(`stash-tab-${chest}`);
  }

  private get stashPaneDropPoint(): Locator {
    return this.page.getByTestId('stash-count');
  }

  private get bagPaneDropPoint(): Locator {
    return this.page.getByTestId('stash-load-value');
  }

  async verifyIsOpen(): Promise<void> {
    await expect(this.board).toBeVisible();
  }

  async verifyIsClosed(): Promise<void> {
    await expect(this.board).toBeHidden();
  }

  async close(): Promise<void> {
    await this.page.getByTestId('stash-close').click();
  }

  async verifyTabStates(states: StashTabState[]): Promise<void> {
    for (const [index, state] of states.entries()) {
      await expect(this.tab(index + 1)).toHaveAttribute('data-state', state);
    }
  }

  async selectTab(chest: number): Promise<void> {
    await this.tab(chest).click();
    await expect(this.tab(chest)).toHaveAttribute('aria-selected', 'true');
  }

  async verifyPrice(price: number): Promise<void> {
    await expect(this.page.getByTestId('stash-price')).toHaveText(String(price));
  }

  async verifyShopHasNoButton(): Promise<void> {
    await expect(this.page.getByTestId('stash-shop').locator('button')).toHaveCount(0);
  }

  async hoverPrice(): Promise<void> {
    await this.page.getByTestId('stash-price').hover();
  }

  async verifyGridHasCells(count: number): Promise<void> {
    await expect(this.page.locator('[data-testid^="stash-cell-"]')).toHaveCount(count);
  }

  async dragBagItemToStashCell(itemKey: string, index: number): Promise<void> {
    await this.dragBetween(this.bagCellWith(itemKey), this.stashCell(index), { shift: false });
  }

  async splitDragBagItemToStashCell(itemKey: string, index: number): Promise<void> {
    await this.dragBetween(this.bagCellWith(itemKey), this.stashCell(index), { shift: true });
  }

  async dragBagItemToStashPane(itemKey: string): Promise<void> {
    await this.dragBetween(this.bagCellWith(itemKey), this.stashPaneDropPoint, { shift: false });
  }

  async dragStashItemToFreeBagCell(index: number): Promise<void> {
    await this.dragBetween(this.stashCell(index), this.freeBagCell, { shift: false });
  }

  async dragStashItemToBagPane(index: number): Promise<void> {
    await this.dragBetween(this.stashCell(index), this.bagPaneDropPoint, { shift: false });
  }

  async holdBagItemOverStashCell(itemKey: string, index: number): Promise<void> {
    await this.dragBetween(this.bagCellWith(itemKey), this.stashCell(index), {
      shift: false,
      release: false,
    });
  }

  async releasePointer(): Promise<void> {
    await this.page.mouse.up();
  }

  async pressEscape(): Promise<void> {
    await this.page.keyboard.press('Escape');
  }

  async quickMoveBagItem(itemKey: string): Promise<void> {
    await this.bagCellWith(itemKey).dblclick();
  }

  async quickMoveStashItem(index: number): Promise<void> {
    await this.stashCell(index).click({ button: 'right' });
  }

  async storeResources(): Promise<void> {
    await this.page.getByTestId('stash-store-resources').click();
  }

  async sort(): Promise<void> {
    await this.page.getByTestId('stash-sort').click();
  }

  async chooseFilter(filter: StashFilterId): Promise<void> {
    await this.page.getByTestId(`stash-filter-${filter}`).click();
    await expect(this.page.getByTestId(`stash-filter-${filter}`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }

  async verifyCellDimmed(index: number, dimmed: boolean): Promise<void> {
    const cell = this.stashCell(index);
    if (dimmed) await expect(cell).toHaveClass(/is-dim/);
    else await expect(cell).not.toHaveClass(/is-dim/);
  }

  async verifyCellShows(index: number, itemKey: string, amount: number): Promise<void> {
    const cell = this.stashCell(index);
    await expect(cell).toHaveAttribute('data-item-key', itemKey);
    await expect(cell).toHaveAttribute('data-item-amount', String(amount));
  }

  async givenChests(count: number): Promise<void> {
    await this.page.evaluate((n) => window.__HEXOFLAT_TEST__!.setStashChests(n), count);
  }

  async givenBag(cells: StashCellContent[]): Promise<void> {
    await this.page.evaluate((fixture) => window.__HEXOFLAT_TEST__!.setBag(fixture), cells);
  }

  async givenStash(cells: StashCellContent[]): Promise<void> {
    await this.page.evaluate((fixture) => window.__HEXOFLAT_TEST__!.setStash(fixture), cells);
  }

  async verifyChests(count: number): Promise<void> {
    await expect
      .poll(() => this.page.evaluate(() => window.__HEXOFLAT_TEST__!.getStashChests()), POLL)
      .toBe(count);
  }

  async verifyStashCell(index: number, expected: StashCellContent): Promise<void> {
    await expect
      .poll(
        () =>
          this.page.evaluate((i) => {
            const cell = window.__HEXOFLAT_TEST__!.getStash()[i] ?? null;
            return cell ? { key: cell.key, amount: cell.amount } : null;
          }, index),
        POLL,
      )
      .toEqual(expected);
  }

  async verifyStashFirstKeys(keys: (string | null)[]): Promise<void> {
    await expect
      .poll(
        () =>
          this.page.evaluate(
            (count) =>
              window
                .__HEXOFLAT_TEST__!.getStash()
                .slice(0, count)
                .map((cell) => cell?.key ?? null),
            keys.length,
          ),
        POLL,
      )
      .toEqual(keys);
  }

  async verifyBagAmount(itemKey: string, amount: number): Promise<void> {
    await expect
      .poll(
        () =>
          this.page.evaluate(
            (key) =>
              window
                .__HEXOFLAT_TEST__!.getBag()
                .reduce((sum, cell) => (cell?.key === key ? sum + cell.amount : sum), 0),
            itemKey,
          ),
        POLL,
      )
      .toBe(amount);
  }

  private async dragBetween(
    source: Locator,
    target: Locator,
    options: { shift: boolean; release?: boolean },
  ): Promise<void> {
    const { shift, release = true } = options;
    await expect(source).toBeVisible();
    await source.scrollIntoViewIfNeeded();
    await target.scrollIntoViewIfNeeded();
    const [from, to] = await Promise.all([source.boundingBox(), target.boundingBox()]);
    if (!from || !to) throw new Error('dragBetween: source or target has no bounding box.');
    const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    const end = { x: to.x + to.width / 2, y: to.y + to.height / 2 };

    await this.page.mouse.move(start.x, start.y);
    if (shift) await this.page.keyboard.down('Shift');
    await this.page.mouse.down();
    for (let step = 1; step <= DRAG_MOVE_STEPS; step += 1) {
      const t = step / DRAG_MOVE_STEPS;
      await this.page.mouse.move(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t);
    }
    if (release) await this.page.mouse.up();
    if (shift) await this.page.keyboard.up('Shift');
  }
}
