import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { getPrototype } from '../content/content-accessors';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import { MAX_EQUIPMENT_HEARTS } from './heart-slots';

/** Extra maximum hearts an equipped item gives; anything that is not equipment gives none. */
export function getHeartPoints(key?: THexobjectKey | null): number {
  if (!key) return 0;

  const proto = getPrototype(key);
  if (proto?.groupType !== EHexobjectGroup.EQUIPMENT) return 0;

  return Math.min(MAX_EQUIPMENT_HEARTS, Math.max(0, Math.floor(proto.equipment.hearts ?? 0)));
}

export function sumHeartPoints(keys: ReadonlyArray<THexobjectKey | null | undefined>): number {
  return keys.reduce((sum, key) => sum + getHeartPoints(key), 0);
}
