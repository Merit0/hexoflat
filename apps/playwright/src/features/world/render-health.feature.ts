import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';

export class RenderHealthFeature extends BaseFeature {
  private readonly map = new CampingMapPage();
  private idleTickerListeners = 0;

  async recordTheIdleWorldBoard(): Promise<void> {
    await this.step('Record the animations of the idle world board', async () => {
      await this.map.activeBoard.verifyOnly('world');
      await this.map.activeBoard.verifyHeroTokenSettled();
      this.idleTickerListeners = (
        await this.map.activeBoard.readRenderStats()
      ).sharedTickerListeners;
    });
  }

  async verifyTheWorldBoardIsClean(): Promise<void> {
    await this.step(
      'Verify one board app, no animation left over, and the hero token walks',
      async () => {
        await this.map.activeBoard.verifyOnly('world');
        await this.map.activeBoard.verifySharedTickerBackTo(this.idleTickerListeners);
        await this.map.hexBoard.moveOneStep();
        await this.map.activeBoard.verifyHeroTokenSettled();
        await this.map.activeBoard.verifySharedTickerBackTo(this.idleTickerListeners);
      },
    );
  }
}
