import { expect } from '@playwright/test';
import { BasePage } from '@framework/base-page';
import { HeroBoardPanelComponent } from '@components/hero-board-panel.component';
import { MapSessionControlsComponent } from '@components/map-session-controls.component';
import { EventsLogComponent } from '@components/events-log.component';
import { HexBoardComponent } from '@components/hex-board.component';
import { SettingsOverlayComponent } from '@components/settings-overlay.component';
import { ToolActionOverlayComponent } from '@components/tool-action-overlay.component';
import { HeroInventoryComponent } from '@components/hero-inventory.component';

/** The `/world/camping` route — the game board and everything layered on it. */
export class CampingMapPage extends BasePage {
  readonly heroBoardPanel = new HeroBoardPanelComponent();
  readonly mapSessionControls = new MapSessionControlsComponent();
  readonly eventsLog = new EventsLogComponent();
  readonly hexBoard = new HexBoardComponent();
  readonly settingsOverlay = new SettingsOverlayComponent();
  readonly toolActionOverlay = new ToolActionOverlayComponent();
  readonly inventory = new HeroInventoryComponent();

  async goto(): Promise<void> {
    await this.page.goto('/world/camping');
  }

  async reload(): Promise<void> {
    await this.page.reload();
  }

  async waitUntilReady(): Promise<void> {
    await this.verifyUrlIsCamping();
    await this.hexBoard.waitForReady();
  }

  async verifyUrlIsCamping(): Promise<void> {
    await expect(this.page).toHaveURL(/\/world\/camping/);
  }
}
