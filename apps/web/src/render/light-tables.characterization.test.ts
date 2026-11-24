import { describe, expect, it } from 'vitest';
import { ETokenType } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { DIMENSION_TIERS } from '@hexoflat/engine/dimensions/dimensions';
import {
  LIGHTS_BY_NAME,
  LIGHT_NAMES,
  lightNameOf,
} from '@hexoflat/engine/content/token-type-rules';
import { LIGHT_TONES, lightFrameFile } from '@hexoflat/engine/tokens/light-tone';
import type { ItemToken } from '@hexoflat/engine/tokens/token-schema';
import { LIGHT_FRAME_URLS, LIGHT_NAME_COLOR, LIGHT_NAME_FRAME_URLS } from './light';
import { LIGHT_FRAMES_DIR, tokenLightTone, tokenLightUrl, tokenLightName } from './token-look';

const PAIRS = [
  ['base', ETokenType.GLOOM],
  ['unique', ETokenType.GLOOM],
  ['base', ETokenType.IDOL],
  ['unique', ETokenType.IDOL],
  ['base', ETokenType.SPARK],
  ['unique', ETokenType.SPARK],
  ['unique', ETokenType.ALIEN],
] as const;

function lightOf(tier: 'base' | 'unique', tokenType: ETokenType): ItemToken {
  return { tier, tokenType } as ItemToken;
}

describe('DA3a B7: web light tables are derived from the engine dimension record', () => {
  it('B7: web light colors are the engine values by construction', () => {
    expect(Object.keys(LIGHT_NAME_COLOR)).toEqual([...LIGHT_NAMES]);
    expect(Object.keys(LIGHT_NAME_FRAME_URLS)).toEqual([...LIGHT_NAMES]);
    for (const tone of LIGHT_NAMES) {
      const light = LIGHTS_BY_NAME[tone];
      expect(LIGHT_NAME_COLOR[tone]).toBe(light.color);
      expect(LIGHT_NAME_FRAME_URLS[tone]).toBe(LIGHT_FRAME_URLS[light.id]);
    }
    expect(Object.keys(LIGHT_FRAME_URLS).sort()).toEqual(
      DIMENSION_TIERS.map((view) => view.light.id).sort(),
    );
  });

  it.each(PAIRS)(
    'B7: %s %s has the same frame in render/tokenType.ts and the engine',
    (tier, tokenType) => {
      const token = lightOf(tier, tokenType);
      const engineUrl = `${LIGHT_FRAMES_DIR}${lightFrameFile(tokenLightTone(token))}`;
      expect(tokenLightUrl(token)).toBe(engineUrl);
      expect(LIGHT_NAME_FRAME_URLS[tokenLightName(token)]).toBe(engineUrl);
      expect(lightNameOf({ kind: tokenType, boss: tier === 'unique' })).toBe(tokenLightName(token));
    },
  );

  it('B7: token-look maps every engine light tone to a different web tone', () => {
    const webTones = PAIRS.map(([tier, tokenType]) => tokenLightName(lightOf(tier, tokenType)));
    expect(new Set(webTones).size).toBe(LIGHT_TONES.length);
    expect(new Set(webTones)).toEqual(new Set(Object.keys(LIGHT_NAME_FRAME_URLS)));
  });
});
