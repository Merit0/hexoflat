import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { getPrototype } from '../content/content-accessors';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import { roundToSingleDecimal } from '../utils/combat/health-format';

/**
 * How much damage actually lands.
 *
 * The `max(0, raw - block)` formula used to exist twice — once in the hero's
 * attack and once in the enemy's — with the rounding written out separately
 * in each. Two copies of a balance formula is exactly the kind of drift that
 * shows up as "the shield works differently depending on who swings".
 *
 * Nothing here decides *whether* an attack happens; that is combat-rules.
 * These are the numbers only, which is what makes them safe to move ahead of
 * the combat design being settled.
 */

const MIN_HERO_RAW_DAMAGE = 0.1;
const DEFAULT_ENEMY_ATTACK = 1;

/** Defence contributed by whatever tool backs a defend marker. */
export function getMarkerDefense(toolKey?: THexobjectKey | null): number {
  if (!toolKey) return 0;

  const proto = getPrototype(toolKey);
  if (!proto) return 0;

  if (proto.groupType === EHexobjectGroup.EQUIPMENT) {
    return Math.max(0, Number(proto.equipment.defense ?? 0));
  }
  if (proto.groupType === EHexobjectGroup.TOOL) {
    return Math.max(0, Number(proto.tool.defense ?? 0));
  }

  return 0;
}

/** A weapon's attack multiplier; anything that is not a weapon scales by 1. */
export function getAttackMultiplier(toolKey?: THexobjectKey | null): number {
  if (!toolKey) return 1;

  const proto = getPrototype(toolKey);
  if (proto?.groupType === EHexobjectGroup.EQUIPMENT) return proto.weapon?.attackMultiplier ?? 1;
  if (proto?.groupType === EHexobjectGroup.TOOL) return proto.tool.attackMultiplier ?? 1;

  return 1;
}

/**
 * The hero's swing before any block is applied. Floored just above zero so a
 * weak weapon still registers as a hit rather than a no-op.
 */
export function calculateHeroRawDamage(heroAttack: number, toolKey?: THexobjectKey | null): number {
  return Math.max(
    MIN_HERO_RAW_DAMAGE,
    roundToSingleDecimal(heroAttack * getAttackMultiplier(toolKey)),
  );
}

/** An enemy's swing before any block is applied. */
export function calculateEnemyRawDamage(creatureAttack?: number | null): number {
  return creatureAttack ?? DEFAULT_ENEMY_ATTACK;
}

/**
 * Subtracts a block from a raw hit. Never negative: a block stronger than
 * the hit absorbs it completely rather than healing the target.
 */
export function applyBlock(rawDamage: number, blockDefense: number): number {
  return Math.max(0, roundToSingleDecimal(rawDamage - blockDefense));
}
