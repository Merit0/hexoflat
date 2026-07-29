import type HexMapModel from '../../map/models/hex-map-model';
import { IActionContext } from '../../abstraction/abstract-action';
import { ACTION_FINISHERS } from '../../registry/action-finishers-registry';

export class FinishPendingActionsFeature {
  private readonly map: HexMapModel;

  constructor(map: HexMapModel) {
    this.map = map;
  }

  public finish(ctx: IActionContext): boolean {
    const now = ctx.now;
    let changed = false;

    for (const tile of this.map.tiles) {
      const action = tile.pendingAction;
      if (!action) continue;

      if (now < action.endsAt) continue;

      const finisher = ACTION_FINISHERS[action.type];
      if (finisher) {
        changed = finisher(tile, action, ctx) || changed;
      } else {
        changed = true;
      }

      if (tile.pendingAction === action) {
        tile.pendingAction = null;
        changed = true;
      }
    }

    return changed;
  }
}
