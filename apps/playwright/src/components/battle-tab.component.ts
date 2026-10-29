import { expect } from '@playwright/test';
import { BaseComponent } from '@framework/base-component';

/** The BATTLE tab and the battle board laid over the map (battle-tab.vue, battle-board-area.vue). */
export class BattleTabComponent extends BaseComponent {
  async startBattle(): Promise<void> {
    await this.page.getByTestId('battle-start').click();
    await expect(this.page.getByTestId('battle-board')).toBeVisible();
  }

  async leaveBattle(): Promise<void> {
    await this.page.getByTestId('battle-leave').click();
  }

  async verifyBoardClosed(): Promise<void> {
    await expect(this.page.getByTestId('battle-board-area')).toBeHidden();
    await expect(this.page.getByTestId('battle-tab')).toBeHidden();
  }
}
