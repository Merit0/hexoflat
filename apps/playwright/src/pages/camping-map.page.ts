import { DimensionItemsComponent } from '@components/dimension-items.component';
import { EquipmentUseComponent } from '@components/equipment-use.component';
import { KnowledgeBoardComponent } from '@components/knowledge-board.component';
import { expect } from '@playwright/test';
import { BasePage } from '@framework/base-page';
import { HeroBoardPanelComponent } from '@components/hero-board-panel.component';
import { MapSessionControlsComponent } from '@components/map-session-controls.component';
import { EventsLogComponent } from '@components/events-log.component';
import { HexBoardComponent } from '@components/hex-board.component';
import { SettingsOverlayComponent } from '@components/settings-overlay.component';
import { ToolActionOverlayComponent } from '@components/tool-action-overlay.component';
import { HeroInventoryComponent } from '@components/hero-inventory.component';
import { ActionAlertBannerComponent } from '@components/action-alert-banner.component';
import { BattleCollectComponent } from '@components/battle-collect.component';
import { BattleTabComponent } from '@components/battle-tab.component';
import { HexInfoTooltipComponent } from '@components/hex-info-tooltip.component';
import { PageErrorsComponent } from '@components/page-errors.component';
import { StashBoardComponent } from '@components/stash-board.component';
import { ShopBoardComponent } from '@components/shop-board.component';
import { QuestBoardComponent } from '@components/quest-board.component';
import { QuestFieldComponent } from '@components/quest-field.component';
import { LootBoardComponent } from '@components/loot-board.component';
import { ActiveBoardComponent } from '@components/active-board.component';
import { EquipmentFogComponent } from '@components/equipment-fog.component';
import { EquipmentWillComponent } from '@components/equipment-will.component';
import { EquipmentSmartStepComponent } from '@components/equipment-smart-step.component';
import { EquipmentWisdomComponent } from '@components/equipment-wisdom.component';
import { EquipmentYieldComponent } from '@components/equipment-yield.component';
import { EquipmentTrophyComponent } from '@components/equipment-trophy.component';

/** The `/world/camping` route — the game board and everything layered on it. */
export class CampingMapPage extends BasePage {
  readonly dimensionItems = new DimensionItemsComponent();
  readonly knowledge = new KnowledgeBoardComponent();
  readonly heroBoardPanel = new HeroBoardPanelComponent();
  readonly mapSessionControls = new MapSessionControlsComponent();
  readonly eventsLog = new EventsLogComponent();
  readonly hexBoard = new HexBoardComponent();
  readonly settingsOverlay = new SettingsOverlayComponent();
  readonly toolActionOverlay = new ToolActionOverlayComponent();
  readonly inventory = new HeroInventoryComponent();
  readonly actionAlertBanner = new ActionAlertBannerComponent();
  readonly battleTab = new BattleTabComponent();
  readonly battleCollect = new BattleCollectComponent();
  readonly hexInfoTooltip = new HexInfoTooltipComponent();
  readonly stashBoard = new StashBoardComponent();
  readonly shopBoard = new ShopBoardComponent();
  readonly questBoard = new QuestBoardComponent();
  readonly questField = new QuestFieldComponent();
  readonly lootBoard = new LootBoardComponent();
  readonly pageErrors = new PageErrorsComponent();
  readonly activeBoard = new ActiveBoardComponent();
  readonly equipmentFog = new EquipmentFogComponent();
  readonly equipmentUse = new EquipmentUseComponent();
  readonly equipmentWill = new EquipmentWillComponent();
  readonly equipmentSmartStep = new EquipmentSmartStepComponent();
  readonly equipmentWisdom = new EquipmentWisdomComponent();
  readonly equipmentYield = new EquipmentYieldComponent();
  readonly equipmentTrophy = new EquipmentTrophyComponent();

  async goto(): Promise<void> {
    await this.page.goto('/world/camping');
  }

  async reload(): Promise<void> {
    await this.page.reload();
  }

  async waitUntilReady(): Promise<void> {
    await this.verifyUrlIsCamping();
    await this.activeBoard.waitForReady();
  }

  async verifyUrlMatches(pattern: RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pattern);
  }

  async verifyUrlIsCamping(): Promise<void> {
    await expect(this.page).toHaveURL(/\/world\/camping/);
  }
}
