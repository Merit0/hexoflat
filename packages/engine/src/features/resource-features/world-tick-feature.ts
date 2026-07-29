import type HexMapModel from '../../map/models/hex-map-model';
import { FinishPendingActionsFeature } from './finish-pending-actions-feature';
import { SpawnResourceFeature } from './spawn-resource-feature';
import type { IActionContext } from '../../abstraction/abstract-action';

export class WorldTickFeature {
  private readonly map: HexMapModel;

  constructor(map: HexMapModel) {
    this.map = map;
  }

  /**
   * Returns true if world state changed and should be saved.
   */
  public tick(ctx: IActionContext): boolean {
    let changed = false;

    changed = new FinishPendingActionsFeature(this.map).finish(ctx) || changed;
    changed = new SpawnResourceFeature(this.map).spawn(ctx.now) || changed;

    return changed;
  }
}
