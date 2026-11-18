import { ITEM_TYPES } from '../content/item-types.content';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import { HERO_SHIELD_SLOTS } from './shield-slots';

export { HERO_SHIELD_SLOTS };

/** Shields an equipped item adds; anything that is not equipment adds none. */
export function getShieldPoints(key?: THexobjectKey | null): number {
  if (!key) return 0;

  return Math.min(
    HERO_SHIELD_SLOTS,
    ITEM_TYPES.find((type) => type.key === key)?.block?.sides ?? 0,
  );
}

/** Total shields from everything the hero wears, capped at the slot count. */
export function sumShieldPoints(keys: ReadonlyArray<THexobjectKey | null | undefined>): number {
  const total = keys.reduce((sum, key) => sum + getShieldPoints(key), 0);
  return Math.min(HERO_SHIELD_SLOTS, total);
}
