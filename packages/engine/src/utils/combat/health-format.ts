/** The maximum a hero can heal up to: base plus gear bonus when the hero model reports it. */
export function healthCapOf(hero: {
  maxHealth: number;
  getEffectiveMaxHealth?: () => number;
}): number {
  return hero.getEffectiveMaxHealth?.() ?? hero.maxHealth;
}

export function roundToSingleDecimal(value: number): number {
  return Number(value.toFixed(1));
}

export function normalizeHealthValue(value: number, min = 0): number {
  return Math.max(min, roundToSingleDecimal(value));
}
