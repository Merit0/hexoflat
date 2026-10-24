import { describe, expect, it } from 'vitest';
import { fogLookForPolicy, hiddenTileLook } from './fog-look';

describe('fog look', () => {
  it('maps the by-region policy (the cave) to darkness and every other policy to clouds', () => {
    expect(fogLookForPolicy('BY_REGION')).toBe('dark');
    expect(fogLookForPolicy('FOG')).toBe('clouds');
    expect(fogLookForPolicy('ALL_REVEALED')).toBe('clouds');
    expect(fogLookForPolicy(undefined)).toBe('clouds');
  });

  it('clouds use the cloud sprite and never a flat fill', () => {
    expect(hiddenTileLook('clouds')).toEqual({
      kind: 'texture',
      url: '/hex-assets/hex-effects/cloud-hex.png',
    });
  });

  it('darkness never uses the cloud sprite: a flat dark fill until a dedicated sprite is set', () => {
    const look = hiddenTileLook('dark');

    expect(look.kind === 'texture' ? look.url : '').not.toContain('cloud');
    if (look.kind === 'fill') expect(look.color).toBeLessThan(0x333333);
  });
});
