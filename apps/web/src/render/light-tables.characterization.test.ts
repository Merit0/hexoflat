import { describe, expect, it } from 'vitest';
import { ERarityKind } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { DIMENSION_TIERS } from '@hexoflat/engine/dimensions/dimensions';
import {
  RARITY_TONE_LIGHTS,
  RARITY_TONES,
  rarityTone,
} from '@hexoflat/engine/content/rarity-rules';
import { LIGHT_TONES, lightFrameFile } from '@hexoflat/engine/tokens/light-tone';
import type { ItemToken } from '@hexoflat/engine/tokens/token-schema';
import { LIGHT_FRAME_URLS, RARITY_COLOR, RARITY_FRAME_URLS } from './rarity';
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

describe('DA3a B7: web light tables are derived from the engine dimension record', () => {
  it('B7: web light colors are the engine values by construction', () => {
    expect(Object.keys(RARITY_COLOR)).toEqual([...RARITY_TONES]);
    expect(Object.keys(RARITY_FRAME_URLS)).toEqual([...RARITY_TONES]);
    for (const tone of RARITY_TONES) {
      const light = RARITY_TONE_LIGHTS[tone];
      expect(RARITY_COLOR[tone]).toBe(light.color);
      expect(RARITY_FRAME_URLS[tone]).toBe(LIGHT_FRAME_URLS[light.id]);
    }
    expect(Object.keys(LIGHT_FRAME_URLS).sort()).toEqual(
      DIMENSION_TIERS.map((view) => view.light.id).sort(),
    );
  });

  it.each(PAIRS)(
    'B7: %s %s has the same frame in render/rarity.ts and the engine',
    (origin, rarity) => {
      const token = lightOf(origin, rarity);
      const engineUrl = `${LIGHT_FRAMES_DIR}${lightFrameFile(tokenLightTone(token))}`;
      expect(tokenLightUrl(token)).toBe(engineUrl);
      expect(RARITY_FRAME_URLS[tokenRarityTone(token)]).toBe(engineUrl);
      expect(rarityTone({ kind: rarity, boss: origin === 'unique' })).toBe(tokenRarityTone(token));
    },
  );

  it('B7: token-look maps every engine light tone to a different web tone', () => {
    const webTones = PAIRS.map(([origin, rarity]) => tokenRarityTone(lightOf(origin, rarity)));
    expect(new Set(webTones).size).toBe(LIGHT_TONES.length);
    expect(new Set(webTones)).toEqual(new Set(Object.keys(RARITY_FRAME_URLS)));
  });
});
