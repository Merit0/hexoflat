import { BaseFeature } from '@framework/base-feature';
import { SilesiaMapPage } from '@pages/silesia-map.page';
import type { TestWorldDescriptor } from '@framework/test-api';

export class VerifyWorldMapFeature extends BaseFeature {
  private readonly silesiaMap = new SilesiaMapPage();

  async verifyGeneratedAndWalkable(): Promise<void> {
    await this.step('Verify the map is an accepted generated map', () =>
      this.silesiaMap.worldMap.verifyAccepted(),
    );
    await this.step('Verify the hero spawned next to the camp anchor', () =>
      this.silesiaMap.worldMap.verifyHeroAdjacentToCampAnchor(),
    );
  }

  async verifyUnchangedAfterReload(before: TestWorldDescriptor): Promise<void> {
    await this.step('Verify the reloaded map is the same generated map', () =>
      this.silesiaMap.worldMap.verifyMatchesAfterReload(before),
    );
  }
}
