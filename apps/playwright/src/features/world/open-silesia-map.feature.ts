import { BaseFeature } from '@framework/base-feature';
import { SilesiaMapPage } from '@pages/silesia-map.page';
import type { TestWorldDescriptor } from '@framework/test-api';

export class OpenSilesiaMapFeature extends BaseFeature {
  private readonly silesiaMap = new SilesiaMapPage();

  /** The generated zone the hero reaches by leaving Camp through the gate. */
  async open(): Promise<void> {
    await this.step('Open the generated Silesia map', async () => {
      await this.silesiaMap.goto();
      await this.silesiaMap.waitUntilReady();
    });
  }

  async reload(): Promise<TestWorldDescriptor> {
    return this.step('Reload the Silesia map', async () => {
      await this.silesiaMap.reload();
      await this.silesiaMap.waitUntilReady();
      return this.silesiaMap.worldMap.requireDescriptor();
    });
  }

  async readDescriptor(): Promise<TestWorldDescriptor> {
    return this.step('Read the world descriptor', () =>
      this.silesiaMap.worldMap.requireDescriptor(),
    );
  }
}
