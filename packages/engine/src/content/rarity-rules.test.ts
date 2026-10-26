import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { DEFAULT_RARITY, RARITY_TONES, rarityTone } from './rarity-rules';

describe('rarityTone', () => {
  it.each([
    [ERarityKind.GLOOM, false, 'gloom'],
    [ERarityKind.GLOOM, true, 'gloom-boss'],
    [ERarityKind.IDOL, false, 'idol'],
    [ERarityKind.IDOL, true, 'idol-boss'],
    [ERarityKind.SPARK, false, 'spark'],
    [ERarityKind.SPARK, true, 'spark-boss'],
    [ERarityKind.GOD_EXECUTOR, false, 'god-executor'],
  ] as const)('maps %s boss=%s to %s', (kind, boss, tone) => {
    expect(rarityTone({ kind, boss })).toBe(tone);
  });

  it('ignores boss on god-executor', () => {
    expect(rarityTone({ kind: ERarityKind.GOD_EXECUTOR, boss: true })).toBe('god-executor');
  });

  it('covers every tone the legend lists', () => {
    expect(RARITY_TONES).toHaveLength(7);
  });

  it('defaults to a plain idol rarity', () => {
    expect(rarityTone(DEFAULT_RARITY)).toBe('idol');
  });
});
