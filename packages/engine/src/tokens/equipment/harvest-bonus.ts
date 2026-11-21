import type { IActionContext } from '../../abstraction/abstract-action';
import { toolActionOf } from '../tool-action';
import type { EHexActionType } from '../../enums/hex-action-type';
import { resolveItemStats } from './item-stats';

export function harvestBonusFor(tool: string, action: EHexActionType, ctx: IActionContext): number {
  if (toolActionOf(tool) !== action) return 0;
  const itemId = ctx.heroToolStore.activeItemId;
  const item = Object.values(ctx.inventory.current?.equip ?? {}).find(
    (item) => item?.key === tool && (!itemId || item.id === itemId),
  );
  return resolveItemStats(item).harvestBonus;
}
