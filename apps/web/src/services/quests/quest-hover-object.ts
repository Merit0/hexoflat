import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import type { THexobject } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { HEXOBJECT_KEYS, type THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import type { QuestFieldModel } from './quest-field-model';

export function questHoverObject(model: QuestFieldModel, hex: IHexCoordinates): THexobject | null {
  const key = coordinateKey(hex);
  if (model.chest && coordinateKey(model.chest) === key) {
    return HexObjectFactory.create(
      model.chestEmpty ? HEXOBJECT_KEYS.CHEST_OPEN : HEXOBJECT_KEYS.CHEST,
      hex,
    );
  }
  const stack = model.ground.find((entry) => coordinateKey(entry.hex) === key);
  if (!stack) return null;
  return HexObjectFactory.create(stack.itemKey as THexobjectKey, hex, { quantity: stack.amount });
}
