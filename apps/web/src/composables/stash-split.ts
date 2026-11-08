export const STASH_SPLIT = {
  MIN_RATIO: 0.25,
  MAX_RATIO: 0.75,
  DEFAULT_RATIO: 0.5,
  KEY_STEP: 0.05,
} as const;

export function clampStashRatio(value: number): number {
  if (!Number.isFinite(value)) return STASH_SPLIT.DEFAULT_RATIO;
  return Math.min(STASH_SPLIT.MAX_RATIO, Math.max(STASH_SPLIT.MIN_RATIO, value));
}
