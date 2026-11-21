import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { deriveStream } from '../utils/random-seeded';
import { CRIT_RESOLVERS, critResolverOf } from './crit-resolver';

describe.each(CRIT_RESOLVERS)('EA-8 crit resolver $id', (resolver) => {
  it('never crits at rating zero, while still resolving every roll', () => {
    const rng = vi.fn(() => 0);
    expect(resolver.resolve({ rating: 0, rng }).critical).toBe(false);
    expect(rng).toHaveBeenCalledOnce();
  });

  it('is deterministic for the same seed, strike and rating', () => {
    const resolve = () =>
      resolver.resolve({ rating: 12, rng: deriveStream('seed', 'combat:b1:strike:3:crit') });
    expect(resolve()).toEqual(resolve());
    expect(critResolverOf(resolver.id)).toBe(resolver);
  });

  it.each(['en', 'uk'])('has a nonempty localized description in %s', (locale) => {
    const dictionary = JSON.parse(
      readFileSync(
        new URL(`../../../../apps/web/src/locales/${locale}/content.json`, import.meta.url),
        'utf8',
      ),
    ) as Record<string, unknown>;
    const line = resolver.describe(12);
    const text = line.key
      .split('.')
      .reduce<unknown>((value, key) => (value as Record<string, unknown>)[key], dictionary);
    expect(typeof text).toBe('string');
    expect((text as string).trim().length).toBeGreaterThan(0);
    expect(line.params).toEqual({ chance: 12 });
  });
});

it('refuses an unregistered resolver instead of silently changing combat rules', () => {
  expect(() => critResolverOf('dice')).toThrow('Unknown crit resolver');
});
