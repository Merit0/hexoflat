import { expect } from '@playwright/test';
import { BasePage } from '@framework/base-page';
import { HexBoardComponent } from '@components/hex-board.component';
import { WorldMapComponent } from '@components/world-map.component';

/** The `/world/silesia` route — the first procedurally generated world zone. */
export class SilesiaMapPage extends BasePage {
  readonly hexBoard = new HexBoardComponent();
  readonly worldMap = new WorldMapComponent();

  async goto(): Promise<void> {
    await this.page.goto('/world/silesia');
  }

  async reload(): Promise<void> {
    await this.page.reload();
  }

  async waitUntilReady(): Promise<void> {
    await expect(this.page).toHaveURL(/\/world\/silesia/);
    await this.hexBoard.waitForReady();
    await this.worldMap.waitForDescriptor();
  }
}
