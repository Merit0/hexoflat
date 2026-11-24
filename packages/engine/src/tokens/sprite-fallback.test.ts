import { afterEach, describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { SPRITE_FALLBACK_ORDER } from '../dimensions/dimensions';
import { LIGHT_COLOR_BY_TONE, lightTone } from './light-tone';
import { createTokenFactory } from './factory/create-token-factory';
import { TOKEN_CONTENT } from '../content/token-content';
import { spriteCoverage } from './sprite-coverage';
import { resolveBaseSprites, resolveTokenSprite } from './sprite-fallback';
import { reportSpriteFallback, setSpriteFallbackLog } from './sprite-fallback-log';
import type { SpriteManifest } from './sprite-files';
import { BASE_TOKEN_TYPES, type TBaseTokenType } from './token-keys';

const { GLOOM, IDOL, SPARK } = ETokenType;
const PLACEHOLDER = '/hex-assets/items/base/_placeholder.png';

function manifestOf(...pairs: [TBaseTokenType, string, string][]): SpriteManifest {
  return {
    placeholder: PLACEHOLDER,
    entries: pairs.map(([tokenType, type, n]) => {
      const key = `${tokenType}-${type}-${n}`;
      const path = `/hex-assets/items/base/${tokenType}-${type}/${key}.png`;
      return { key, tier: 'base', tokenType, type, path };
    }),
  };
}

function resolved(manifest: SpriteManifest, tokenType: ETokenType, type = 'sword') {
  const { step, from, refs } = resolveBaseSprites(manifest, tokenType, type);
  return { step, from, keys: refs.map((ref) => ref.key) };
}

describe('DA4-3: the sprite fallback chain', () => {
  it('lends sprites in the order idol, gloom, spark and covers every base token type', () => {
    expect(SPRITE_FALLBACK_ORDER).toEqual([IDOL, GLOOM, SPARK]);
    expect([...SPRITE_FALLBACK_ORDER].sort()).toEqual([...BASE_TOKEN_TYPES].sort());
  });

  it('step 1: takes every own sprite of the token type and item type', () => {
    const manifest = manifestOf(
      [IDOL, 'sword', '01'],
      [SPARK, 'sword', '01'],
      [SPARK, 'sword', '02'],
    );
    expect(resolved(manifest, SPARK)).toEqual({
      step: 'own',
      from: SPARK,
      keys: ['spark-sword-01', 'spark-sword-02'],
    });
  });

  it.each([
    [SPARK, [GLOOM, IDOL], IDOL],
    [GLOOM, [SPARK, IDOL], IDOL],
    [IDOL, [SPARK, GLOOM], GLOOM],
    [SPARK, [GLOOM], GLOOM],
    [GLOOM, [SPARK], SPARK],
    [IDOL, [SPARK], SPARK],
  ] as const)('step 2: %s with the sprites of %j borrows from %s', (tokenType, owners, from) => {
    const manifest = manifestOf(
      ...owners.map((owner): [TBaseTokenType, string, string] => [owner, 'sword', '01']),
    );
    expect(resolved(manifest, tokenType)).toEqual({
      step: 'borrowed',
      from,
      keys: [`${from}-sword-01`],
    });
  });

  it('step 2 never borrows another item type', () => {
    expect(resolved(manifestOf([IDOL, 'axe', '01']), GLOOM).step).toBe('placeholder');
  });

  it('step 3: uses the placeholder when no base token type has the item type', () => {
    expect(resolveBaseSprites(manifestOf(), GLOOM, 'sword')).toEqual({
      step: 'placeholder',
      from: null,
      refs: [{ key: '_placeholder', path: PLACEHOLDER }],
    });
  });

  it.each([
    ['own', manifestOf([GLOOM, 'sword', '01']), 'gloom-sword-01'],
    ['borrowed', manifestOf([SPARK, 'sword', '01']), 'spark-sword-01'],
    ['placeholder', manifestOf(), '_placeholder'],
  ] as const)('the light follows the token on step %s', (step, manifest, sprite) => {
    const result = createTokenFactory(TOKEN_CONTENT, manifest).createBase({
      seed: 'da4-light',
      sourceId: 'test:da4.light',
      n: 0,
      tokenType: GLOOM,
      mapTier: 1,
      type: 'sword',
    });
    if (!result.ok) throw new Error(result.refusal.code);
    expect(resolveTokenSprite(manifest, result.value).key).toBe(sprite);
    expect(result.value.sprite).toBe(step === 'own' ? sprite : null);
    expect(LIGHT_COLOR_BY_TONE[lightTone(result.value.tier, result.value.tokenType)]).toBe('blue');
  });
});

function mint(manifest: SpriteManifest, tokenType: TBaseTokenType, n = 0) {
  const result = createTokenFactory(TOKEN_CONTENT, manifest).createBase({
    seed: 'da4-render',
    sourceId: 'test:da4.render',
    n,
    tokenType,
    mapTier: 1,
    type: 'sword',
  });
  if (!result.ok) throw new Error(result.refusal.code);
  return result.value;
}

describe('DA4 O10: the fallback is chosen when a token is drawn', () => {
  const idolOnly = manifestOf([IDOL, 'sword', '01']);

  it('a fallback gloom sword takes the gloom sprite once it is in the pool', () => {
    const token = mint(idolOnly, GLOOM);
    expect(token.sprite).toBeNull();
    expect(resolveTokenSprite(idolOnly, token).key).toBe('idol-sword-01');
    const grown = manifestOf([IDOL, 'sword', '01'], [GLOOM, 'sword', '01']);
    expect(resolveTokenSprite(grown, token).key).toBe('gloom-sword-01');
  });

  it('an exact-match token never changes when the pool grows', () => {
    const grown = manifestOf(
      ...['01', '02', '03', '04', '05'].map((n): [TBaseTokenType, string, string] => [
        GLOOM,
        'sword',
        n,
      ]),
      [IDOL, 'sword', '01'],
    );
    const small = manifestOf([GLOOM, 'sword', '02'], [IDOL, 'sword', '01']);
    for (let n = 0; n < 50; n += 1) {
      const token = mint(small, GLOOM, n);
      expect(token.sprite).toBe('gloom-sword-02');
      expect(resolveTokenSprite(grown, token).key).toBe('gloom-sword-02');
    }
  });

  it('picks over the pool by token id: the same id always gets the same sprite, ids spread', () => {
    const pool = manifestOf([IDOL, 'sword', '01'], [IDOL, 'sword', '02'], [IDOL, 'sword', '03']);
    const keys = Array.from({ length: 60 }, (_, n) => {
      const token = mint(pool, SPARK, n);
      const { key } = resolveTokenSprite(pool, token);
      expect(resolveTokenSprite(pool, structuredClone(token)).key).toBe(key);
      return key;
    });
    expect(new Set(keys)).toEqual(new Set(['idol-sword-01', 'idol-sword-02', 'idol-sword-03']));
  });

  it('follows the chain when the stored own sprite is gone from the pool', () => {
    const token = mint(manifestOf([GLOOM, 'sword', '07']), GLOOM);
    expect(token.sprite).toBe('gloom-sword-07');
    expect(resolveTokenSprite(idolOnly, token).key).toBe('idol-sword-01');
    expect(resolveTokenSprite(manifestOf(), token).key).toBe('_placeholder');
  });
});

describe('DA4: the dev warning of a fallback', () => {
  afterEach(() => setSpriteFallbackLog(null));

  it('names the pair and what is used instead', () => {
    const messages: string[] = [];
    setSpriteFallbackLog((message) => messages.push(message));
    const borrowed = resolveBaseSprites(manifestOf([IDOL, 'sword', '01']), GLOOM, 'sword');
    const none = resolveBaseSprites(manifestOf(), SPARK, 'axe');
    reportSpriteFallback(GLOOM, 'sword', borrowed);
    reportSpriteFallback(GLOOM, 'sword', borrowed);
    reportSpriteFallback(SPARK, 'axe', none);
    expect(messages).toEqual([
      '[sprites] base/gloom-sword has no sprite, idol-sword is used',
      '[sprites] base/spark-axe has no sprite, the placeholder is used',
    ]);
  });
});

describe('DA4-4: sprite coverage', () => {
  const content = {
    types: {
      all: () => [
        { key: 'sword', tokenTypes: [GLOOM, IDOL, SPARK] as TBaseTokenType[] },
        { key: 'axe', tokenTypes: [IDOL] as TBaseTokenType[] },
      ],
    },
    uniques: { all: () => [{ key: 'first' }, { key: 'second' }] },
  };

  it('lists the missing pairs an item type can have and the missing uniques', () => {
    const manifest = manifestOf([IDOL, 'sword', '01']);
    manifest.entries.push({
      key: 'first',
      tier: 'unique',
      tokenType: null,
      type: null,
      path: '/hex-assets/items/unique/first.png',
    });
    expect(spriteCoverage(manifest, content)).toEqual({
      pairs: 4,
      missingBase: [
        { tokenType: GLOOM, type: 'sword', uses: IDOL },
        { tokenType: IDOL, type: 'axe', uses: null },
        { tokenType: SPARK, type: 'sword', uses: IDOL },
      ],
      uniques: 2,
      missingUniques: ['second'],
    });
  });

  it('is empty when everything has a sprite', () => {
    const manifest = manifestOf(
      [GLOOM, 'sword', '01'],
      [IDOL, 'sword', '01'],
      [SPARK, 'sword', '01'],
      [IDOL, 'axe', '01'],
    );
    const coverage = spriteCoverage(manifest, { ...content, uniques: { all: () => [] } });
    expect([coverage.missingBase, coverage.missingUniques]).toEqual([[], []]);
  });
});
