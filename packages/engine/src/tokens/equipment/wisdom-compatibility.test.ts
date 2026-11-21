import { describe, expect, it } from 'vitest';
import { EQUIPMENT_ATTRIBUTES } from '../../content/equipment-attributes.content';
import { upcastToken } from '../../inventory/upcast-item-tokens';
import { attributeRowsOf } from '../attribute-display';
import { resolveHeroStats } from './hero-stats';

function token(key: string, value: number) {
  return { ...upcastToken('hero', 'wisdom', 'shield')!, attributes: [{ key, value }] };
}

describe('Wisdom rename compatibility', () => {
  it('keeps the old focus key readable and shares the same cap with wisdom', () => {
    const legacy = { key: 'shield', token: token('focus', 4) };
    const current = { key: 'shield', token: token('wisdom', 4) };
    const before = structuredClone(legacy.token);
    expect(resolveHeroStats([legacy]).answerWillReward).toBe(4);
    expect(resolveHeroStats([current]).answerWillReward).toBe(4);
    expect(resolveHeroStats([legacy, current]).answerWillReward).toBe(5);
    expect(attributeRowsOf(legacy.token)).toMatchObject([
      { value: 4, formatKey: 'content.tokens.attrFormat.plus' },
    ]);
    expect(legacy.token).toEqual(before);
  });

  it('generates only the canonical key while retaining the deprecated definition', () => {
    expect(EQUIPMENT_ATTRIBUTES.find((attribute) => attribute.key === 'focus')).toMatchObject({
      implemented: true,
      deprecated: true,
      stat: 'answerWillReward',
      cap: 5,
    });
    expect(EQUIPMENT_ATTRIBUTES.find((attribute) => attribute.key === 'wisdom')).toMatchObject({
      implemented: true,
      stat: 'answerWillReward',
      cap: 5,
    });
  });
});
