import { describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { DEFAULT_ITEM_TOKEN_TYPE, LIGHT_NAMES, lightNameOf } from './token-type-rules';

describe('lightNameOf', () => {
  it.each([
    [ETokenType.GLOOM, false, 'gloom'],
    [ETokenType.GLOOM, true, 'gloom-boss'],
    [ETokenType.IDOL, false, 'idol'],
    [ETokenType.IDOL, true, 'idol-boss'],
    [ETokenType.SPARK, false, 'spark'],
    [ETokenType.SPARK, true, 'spark-boss'],
    [ETokenType.ALIEN, false, 'alien'],
  ] as const)('maps %s boss=%s to %s', (kind, boss, tone) => {
    expect(lightNameOf({ kind, boss })).toBe(tone);
  });

  it('ignores boss on alien', () => {
    expect(lightNameOf({ kind: ETokenType.ALIEN, boss: true })).toBe('alien');
  });

  it('covers every tone the legend lists', () => {
    expect(LIGHT_NAMES).toHaveLength(7);
  });

  it('defaults to a plain idol tokenType', () => {
    expect(lightNameOf(DEFAULT_ITEM_TOKEN_TYPE)).toBe('idol');
  });
});
