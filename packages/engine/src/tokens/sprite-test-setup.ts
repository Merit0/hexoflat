import { ITEM_TYPES } from '../content/item-types.content';
import { TypeRegistry } from './registries';
import type { PngHeader, SpriteCatalogue, SpriteFile } from './sprite-files';
import { wordKeyOf } from './token-keys';

export function rgbaHeader(width = 512, height = width): PngHeader {
  return { width, height, bitDepth: 8, colorType: 6 };
}

export function spriteFile(path: string, header: PngHeader | null = rgbaHeader()): SpriteFile {
  return { path, header };
}

export function cleanSpriteFiles(): SpriteFile[] {
  return [
    spriteFile('base/_placeholder.png'),
    spriteFile('base/idol-sword/idol-sword-01.png'),
    spriteFile('base/idol-sword/idol-sword-02.png'),
    spriteFile('base/gloom-shield/gloom-shield-01.png'),
    spriteFile('unique/ash-crown-blade.png'),
  ];
}

export function spriteCatalogue(
  uniques: readonly { key: string; tokenType: string }[] = [
    { key: 'ash-crown-blade', tokenType: 'gloom' },
  ],
  types: SpriteCatalogue['types'] = new TypeRegistry(ITEM_TYPES),
): SpriteCatalogue {
  return {
    types,
    uniques: {
      has: (key) => uniques.some((unique) => unique.key === key),
      all: () => uniques,
    },
  };
}

export function typesWithHammer(): TypeRegistry {
  return new TypeRegistry([
    ...ITEM_TYPES,
    {
      key: 'hammer',
      slot: 'weapon',
      strike: 2,
      tool: null,
      nounKey: wordKeyOf('noun', 'hammer'),
      tokenTypes: ITEM_TYPES[0].tokenTypes,
    },
  ]);
}

export function pngHeaderBytes(header: PngHeader): Uint8Array {
  const bytes = new Uint8Array(26);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, header.width);
  view.setUint32(20, header.height);
  bytes[24] = header.bitDepth;
  bytes[25] = header.colorType;
  return bytes;
}
