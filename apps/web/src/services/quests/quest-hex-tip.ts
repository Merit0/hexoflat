import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import type { QuestFieldModel } from './quest-field-model';

export interface QuestHexTip {
  key: string;
  params: Record<string, number>;
  item?: string;
}

export function buildQuestHexTip(model: QuestFieldModel, hex: IHexCoordinates): QuestHexTip | null {
  const key = coordinateKey(hex);
  if (model.chest && coordinateKey(model.chest) === key) {
    return { key: model.chestEmpty ? 'quest.tip.chestEmpty' : 'quest.tip.chest', params: {} };
  }
  const stack = model.ground.find((entry) => coordinateKey(entry.hex) === key);
  if (stack) return { key: 'quest.tip.stack', params: { n: stack.amount }, item: stack.itemKey };
  const cell = model.hexes.find((entry) => coordinateKey(entry.hex) === key);
  if (!cell?.step) return null;
  if (model.collect) return { key: 'quest.tip.free', params: {} };
  return cell.step.back
    ? { key: 'quest.tip.back', params: { n: cell.step.cost } }
    : { key: 'quest.tip.step', params: { n: cell.step.cost } };
}
