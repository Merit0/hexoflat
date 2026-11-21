import { describe, expect, it } from 'vitest';
import { TOKEN_CONTENT } from '../../content/token-content';
import { createTokenFactory } from './create-token-factory';
import { contextFor } from './factory-test-setup';
import { ContentAttributeProfileProvider } from '../equipment/generator/profile-provider';

const context = contextFor(1, { type: 'sword', mapTier: 1 });

describe('final generator audit: content boundaries', () => {
  it('keeps generator and validator on the same immutable profile snapshot', () => {
    const content = structuredClone(TOKEN_CONTENT);
    const factory = createTokenFactory(content);
    const before = factory.createBase(context, { attributes: [{ key: 'crit', value: 2 }] });
    expect(before).toMatchObject({ ok: true });
    content.profiles['tier-1'].attributes.crit.max = 1;
    expect(factory.createBase(context, { attributes: [{ key: 'crit', value: 2 }] })).toEqual(
      before,
    );
  });

  it('does not expose mutable nested generator profiles', () => {
    const provider = new ContentAttributeProfileProvider(TOKEN_CONTENT.profiles);
    expect(() => {
      provider.profileFor(1).attributes.crit.max = 99;
    }).toThrow(TypeError);
    expect(() => {
      provider.profileFor(1).countWeights[0] = 100;
    }).toThrow(TypeError);
    expect(() => {
      provider.profileFor(1).attributes.crit.weight.weapon = 99;
    }).toThrow(TypeError);
  });

  it.each(['unknown', 'wrong-group', 'above-cap'])(
    'rejects %s profile data before minting',
    (fault) => {
      const content = structuredClone(TOKEN_CONTENT);
      const entries = content.profiles['tier-1'].attributes;
      if (fault === 'unknown') entries['missing-attribute'] = { ...entries.crit };
      if (fault === 'wrong-group') entries.crit.weight = { defense: 45 };
      if (fault === 'above-cap') entries.crit.max = 11;
      expect(() => createTokenFactory(content)).toThrow();
    },
  );
});
