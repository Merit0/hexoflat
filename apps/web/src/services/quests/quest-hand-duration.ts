import { getMeta } from '@hexoflat/engine';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import type { QuestProjection } from '@hexoflat/engine/quests/projection';
import { HEXOBJECT_KEYS, type THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { QuestHandAction } from './quest-field-model';

export const DEFAULT_HAND_MS = 300;

export function questHandDurationMs(
  run: QuestProjection,
  at: IHexCoordinates,
  action: QuestHandAction,
): number {
  const key = coordinateKey(at);
  if (action === 'eye') {
    return (
      getMeta(HEXOBJECT_KEYS.CHEST).actions?.[EHexActionType.OPEN]?.durationMs ?? DEFAULT_HAND_MS
    );
  }
  const stack = (run.collect?.ground ?? []).find((item) => coordinateKey(item.hex) === key);
  if (!stack) return DEFAULT_HAND_MS;
  return (
    getMeta(stack.itemKey as THexobjectKey).actions?.[EHexActionType.TAKE]?.durationMs ??
    DEFAULT_HAND_MS
  );
}
