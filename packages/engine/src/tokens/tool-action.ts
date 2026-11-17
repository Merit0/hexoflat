import { ITEM_TYPES } from '../content/item-types.content';
import type { EHexActionType } from '../enums/hex-action-type';

const TOOL_ACTION_OF: ReadonlyMap<string, EHexActionType> = new Map(
  ITEM_TYPES.flatMap((type) => (type.tool ? [[type.key, type.tool.action] as const] : [])),
);

export function toolActionOf(type: string | null | undefined): EHexActionType | null {
  return type ? (TOOL_ACTION_OF.get(type) ?? null) : null;
}
