import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { Tool } from '@config/hero-tool';

/**
 * Equips a specific tool as the hero's active tool, driving whatever
 * contextual action the interactions resolver then offers on hover
 * (TAKE for a bare HAND, CUT for an AXE, ...).
 *
 * Only `Tool.HAND` is reachable today: a fresh hero's weapon/shield hand
 * slots both default to HAND, and the only in-suite way to cycle between
 * them is the scroll-wheel toggle (see hex-board.component.ts's
 * `armHandTool`, which is what this delegates to). Equipping AXE/PICKAXE/
 * SWORD/SHIELD would need the inventory's drag-and-drop equip flow, which
 * this suite doesn't drive yet — `use()` throws a clear error for those
 * instead of silently no-oping and leaving HAND armed.
 */
export class UseHeroToolFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();

  constructor(private readonly tool: Tool) {
    super();
  }

  async use(): Promise<void> {
    await this.step(`Use the hero's "${this.tool}" tool`, async () => {
      if (this.tool !== Tool.HAND) {
        throw new Error(
          `UseHeroToolFeature can only equip Tool.HAND today (asked for "${this.tool}") — ` +
            'see this class’s doc comment for why the other tools aren’t reachable yet.',
        );
      }

      await this.campingMap.hexBoard.armHandTool();
    });
  }
}
