import { ETokenType } from '../abstraction/hexobject-abstraction';
import type { SpriteManifest } from './sprite-files';

export const SPRITE_MANIFEST: SpriteManifest = {
  placeholder: '/hex-assets/items/base/_placeholder.png',
  entries: [
    {
      key: 'idol-axe-01',
      tier: 'base',
      tokenType: ETokenType.IDOL,
      type: 'axe',
      path: '/hex-assets/items/base/idol-axe/idol-axe-01.png',
    },
    {
      key: 'idol-pickaxe-01',
      tier: 'base',
      tokenType: ETokenType.IDOL,
      type: 'pickaxe',
      path: '/hex-assets/items/base/idol-pickaxe/idol-pickaxe-01.png',
    },
    {
      key: 'idol-shield-01',
      tier: 'base',
      tokenType: ETokenType.IDOL,
      type: 'shield',
      path: '/hex-assets/items/base/idol-shield/idol-shield-01.png',
    },
    {
      key: 'idol-sword-01',
      tier: 'base',
      tokenType: ETokenType.IDOL,
      type: 'sword',
      path: '/hex-assets/items/base/idol-sword/idol-sword-01.png',
    },
  ],
};
