import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import type { QuestFieldModel } from './quest-field-model';

export interface QuestHexTip {
  key: string;
  params: Record<string, number>;
}

export function buildQuestHexTip(model: QuestFieldModel, hex: IHexCoordinates): QuestHexTip | null {
  const key = coordinateKey(hex);
  if (model.chest && coordinateKey(model.chest) === key)
    return { key: 'quest.tip.chest', params: {} };
  const cell = model.hexes.find((entry) => coordinateKey(entry.hex) === key);
  if (!cell?.step) return null;
  return cell.step.back
    ? { key: 'quest.tip.back', params: { n: cell.step.cost } }
    : { key: 'quest.tip.step', params: { n: cell.step.cost } };
}
