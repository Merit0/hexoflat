import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { tokenCoordinates, type MapToken } from '@config/test-data';
import type { TestHexCoordinates } from '@framework/test-api';

export class MoveHeroFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  async readPosition(): Promise<TestHexCoordinates> {
    return this.step('Read the hero position', () =>
      this.campingMap.hexBoard.requireHeroCoordinates(),
    );
  }

  async readStepsChipText(): Promise<string> {
    return this.step('Read the steps chip', () => this.campingMap.topbar.readStepsText());
  }

  async moveOneStep(): Promise<TestHexCoordinates> {
    return this.step('Move the hero one hex', () => this.campingMap.hexBoard.moveOneStep());
  }

  /**
   * Several steps, not one: a single step off the map's entry point can land
   * back on one of the (at most one or two) tiles placeHeroAtEntry() would
   * also pick, which let the reload test pass even while restoreSession() was
   * silently resetting the hero to the entry point on every reload — see
   * user-store.ts's applyAuthResult, where restoreSession() used to run
   * through the same clearSessionStorage() call login()/register() use,
   * wiping the very stored position the moved hero lives at. Three steps away
   * makes that coincidence practically impossible.
   */
  async moveSteps(count: number): Promise<TestHexCoordinates> {
    return this.step(`Move the hero ${count} hexes`, async () => {
      let position = await this.campingMap.hexBoard.requireHeroCoordinates();
      for (let step = 0; step < count; step += 1) {
        position = await this.campingMap.hexBoard.moveOneStep();
      }
      return position;
    });
  }

  async moveAdjacentTo(token: MapToken): Promise<void> {
    await this.step(`Walk the hero next to "${token}"`, () =>
      this.campingMap.hexBoard.moveAdjacentTo(tokenCoordinates(token)),
    );
  }
}
