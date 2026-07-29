import type { HexTileModel } from '../map/models/hex-tile-model';
import { EHexActionType } from '../enums/hex-action-type';
import { ACTION_STARTERS, type StartResult } from '../registry/action-starters-registry';
import { THeroToolKey } from '../content/equipment.content';
import type { IActionContext } from '../abstraction/abstract-action';

export class ExecuteHexActionFeature {
  private readonly tile: HexTileModel;

  constructor(tile: HexTileModel) {
    this.tile = tile;
  }

  public execute(actionType: EHexActionType, tool: THeroToolKey, ctx: IActionContext): StartResult {
    const starter = ACTION_STARTERS[actionType];
    if (!starter) return { ok: false, message: `No starters for Action -> [ ${actionType} ]` };

    return starter(this.tile, tool, ctx.now, ctx);
  }
}
