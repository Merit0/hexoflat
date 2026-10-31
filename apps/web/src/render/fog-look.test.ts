import { describe, expect, it } from 'vitest';
import { fogLookForBoardKind, hiddenTileLook } from './fog-look';

describe('fog look', () => {
  it('covers dungeon boards with the mist hex and every other board with clouds', () => {
    expect(fogLookForBoardKind('DUNGEON')).toBe('mist');
    expect(fogLookForBoardKind('STATIC')).toBe('clouds');
    expect(fogLookForBoardKind(undefined)).toBe('clouds');
  });

  it('clouds use the cloud sprite', () => {
    expect(hiddenTileLook('clouds')).toEqual({
      kind: 'texture',
      url: '/hex-assets/hex-effects/cloud-hex.png',
    });
  });

  it('mist uses its own hex sprite and never the cloud one', () => {
    expect(hiddenTileLook('mist')).toEqual({
      kind: 'texture',
      url: '/hex-assets/hex-effects/fog-hex.png',
    });
  });
});
