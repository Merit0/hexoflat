import { describe, expect, it } from 'vitest';
import { EQUIPMENT_ATTRIBUTES } from '../../content/equipment-attributes.content';
import { sampleToken } from '../token-test-setup';
import { resolveItemStats } from './item-stats';
import { resolveHeroStats } from './hero-stats';

describe('EA-16 item stats', () => {
  const item = {
    key: 'axe',
    token: sampleToken({
      type: 'axe',
      name: { kind: 'noun', noun: 'axe' },
      attributes: [
        { key: 'yield', value: 2 },
        { key: 'heart', value: 1 },
        { key: 'trophy', value: 2 },
        { key: 'unknown', value: 100 },
      ],
    }),
  };

  it('resolves only implemented item attributes without leaking them to hero stats', () => {
    const stats = resolveItemStats(item);
    expect(stats.harvestBonus).toBe(2);
    expect(stats.maxHearts).toBe(0);
    expect(stats.graveLootBonus).toBe(2);
    expect(resolveHeroStats([item]).harvestBonus).toBe(0);
    expect(resolveItemStats(null).harvestBonus).toBe(0);
  });

  it('retains deprecated owned attributes and applies the same cap rules', () => {
    const attributes = EQUIPMENT_ATTRIBUTES.map((definition) =>
      definition.key === 'yield' ? { ...definition, deprecated: true } : definition,
    );
    expect(resolveItemStats(item, attributes).harvestBonus).toBe(2);
    expect(
      resolveItemStats({
        key: 'axe',
        token: { ...item.token, attributes: [{ key: 'yield', value: 9 }] },
      }).harvestBonus,
    ).toBe(2);
  });
});
