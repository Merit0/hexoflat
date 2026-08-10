import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { MoveHeroFeature } from '@features/world/move-hero.feature';
import { UseHeroToolFeature } from '@features/world/use-hero-tool.feature';
import { Tool } from '@config/hero-tool';
import { tokenCoordinates, type MapToken } from '@config/test-data';

/**
 * Picking a token up off the map with the hero's bare HAND — the whole
 * real-world action, not just the final click. Composes the Features a
 * player actually goes through to get there (walk next to the token, equip
 * the HAND tool) so a spec reads as one business step — `take()` — instead of
 * every caller having to re-sequence the same three calls by hand. Both
 * composed Features remain independently usable (e.g. a spec that only wants
 * to equip a tool without taking anything).
 *
 * There is no in-game way yet to reach a TREE/ROCK (the RESOURCE group):
 * those only exist on the 'silesia' map, and cutting/mining them needs an
 * AXE/PICKAXE the hero doesn't start with (see the engine's
 * resources.content.ts `requiredTool`). Taking the starter AXE placed in the
 * safe camping zone exercises the same START_HEX_ACTION → TAKE pipeline
 * without also depending on cross-map travel or fog-of-war reveal.
 */
export class TakeTokenFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  constructor(private readonly token: MapToken) {
    super();
  }

  async take(): Promise<void> {
    await this.step(`Take whatever sits on "${this.token}"`, async () => {
      await new MoveHeroFeature().moveAdjacentTo(this.token);
      await new UseHeroToolFeature(Tool.HAND).use();

      await this.campingMap.hexBoard.hoverTile(tokenCoordinates(this.token));
      await this.campingMap.toolActionOverlay.triggerAction();
    });
  }
}
