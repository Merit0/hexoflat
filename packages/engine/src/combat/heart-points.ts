import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { getPrototype } from '../content/content-accessors';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import type { ItemToken } from '../tokens/token-schema';
import { MAX_EQUIPMENT_HEARTS } from './heart-slots';

export const HEART_ATTRIBUTE_KEY = 'heart';

const HALF_HEARTS_PER_HEART = 2;

function capped(hearts: number): number {
  return Math.min(MAX_EQUIPMENT_HEARTS, Math.max(0, hearts));
}

export function getHeartPoints(key?: THexobjectKey | null): number {
  if (!key) return 0;

  const proto = getPrototype(key);
  if (proto?.groupType !== EHexobjectGroup.EQUIPMENT) return 0;

  return capped(proto.equipment.hearts ?? 0);
}

export function tokenHeartPoints(token: ItemToken): number {
  const halfHearts = token.attributes
    .filter((attribute) => attribute.key === HEART_ATTRIBUTE_KEY)
    .reduce((sum, attribute) => sum + attribute.value, 0);
  return capped(halfHearts / HALF_HEARTS_PER_HEART);
}

export interface HeartCell {
  key: string;
  token?: ItemToken;
}

export function cellHeartPoints(cell: HeartCell | null | undefined): number {
  if (!cell) return 0;
  return cell.token ? tokenHeartPoints(cell.token) : getHeartPoints(cell.key as THexobjectKey);
}

export function sumHeartPoints(keys: ReadonlyArray<THexobjectKey | null | undefined>): number {
  return keys.reduce((sum, key) => sum + getHeartPoints(key), 0);
}
