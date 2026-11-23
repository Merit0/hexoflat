import { describe, expect, it } from 'vitest';
import { ERarityKind } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { rarityTone } from '@hexoflat/engine/content/rarity-rules';
import { LIGHT_TONES, lightFrameFile } from '@hexoflat/engine/tokens/light-tone';
import type { ItemToken } from '@hexoflat/engine/tokens/token-schema';
import { RARITY_COLOR, RARITY_FRAME_URLS } from './rarity';
import { LIGHT_FRAMES_DIR, tokenLightTone, tokenLightUrl, tokenRarityTone } from './token-look';

const PAIRS = [
  ['base', ERarityKind.GLOOM],
  ['unique', ERarityKind.GLOOM],
  ['base', ERarityKind.IDOL],
  ['unique', ERarityKind.IDOL],
  ['base', ERarityKind.SPARK],
  ['unique', ERarityKind.SPARK],
  ['unique', ERarityKind.ALIEN],
] as const;

function lightOf(origin: 'base' | 'unique', rarity: ERarityKind): ItemToken {
  return { origin, rarity } as ItemToken;
}

describe('DA2 B7: web light tables duplicate the engine light table', () => {
  it('CURRENT (B7): the web tables hold one entry per engine light tone', () => {
    expect(Object.keys(RARITY_FRAME_URLS)).toHaveLength(LIGHT_TONES.length);
    expect(Object.keys(RARITY_COLOR).sort()).toEqual(Object.keys(RARITY_FRAME_URLS).sort());
  });

  it.each(PAIRS)(
    'CURRENT (B7): %s %s has the same frame in render/rarity.ts and the engine',
    (origin, rarity) => {
      const token = lightOf(origin, rarity);
      const engineUrl = `${LIGHT_FRAMES_DIR}${lightFrameFile(tokenLightTone(token))}`;
      expect(tokenLightUrl(token)).toBe(engineUrl);
      expect(RARITY_FRAME_URLS[tokenRarityTone(token)]).toBe(engineUrl);
      expect(rarityTone({ kind: rarity, boss: origin === 'unique' })).toBe(tokenRarityTone(token));
    },
  );

  it('CURRENT (B7): token-look maps every engine light tone to a different web tone', () => {
    const webTones = PAIRS.map(([origin, rarity]) => tokenRarityTone(lightOf(origin, rarity)));
    expect(new Set(webTones).size).toBe(LIGHT_TONES.length);
    expect(new Set(webTones)).toEqual(new Set(Object.keys(RARITY_FRAME_URLS)));
  });
});
