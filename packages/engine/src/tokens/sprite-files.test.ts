import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { createTokenRegistries } from '../content/token-content';
import {
  buildSpriteManifest,
  readPngHeader,
  type SpriteFile,
  type TSpriteFailureCode,
} from './sprite-files';
import { ManifestSpriteRegistry } from './sprite-registry';
import {
  cleanSpriteFiles,
  pngHeaderBytes,
  rgbaHeader,
  spriteFile,
  typesWithHammer,
} from './sprite-test-setup';

const types = createTokenRegistries().types;

function failureCodes(files: SpriteFile[]): TSpriteFailureCode[] {
  const result = buildSpriteManifest(files, types);
  return result.ok ? [] : result.failures.map((failure) => failure.code);
}

function withFile(file: SpriteFile): SpriteFile[] {
  return [...cleanSpriteFiles(), file];
}

describe('readPngHeader', () => {
  it('reads width, height, bit depth and color type from the IHDR bytes', () => {
    expect(readPngHeader(pngHeaderBytes(rgbaHeader(512, 300)))).toEqual(rgbaHeader(512, 300));
  });

  it('returns null for bytes without the PNG signature', () => {
    const bytes = pngHeaderBytes(rgbaHeader());
    bytes[1] = 0;
    expect(readPngHeader(bytes)).toBeNull();
  });

  it('returns null for a file shorter than the header', () => {
    expect(readPngHeader(pngHeaderBytes(rgbaHeader()).subarray(0, 20))).toBeNull();
  });
});

describe('buildSpriteManifest', () => {
  it('lists base and unique sprites sorted by path, with the placeholder apart', () => {
    const result = buildSpriteManifest(cleanSpriteFiles(), types);
    expect(result).toEqual({
      ok: true,
      manifest: {
        placeholder: '/hex-assets/items/base/_placeholder.png',
        entries: [
          {
            key: 'gloom-shield-01',
            origin: 'base',
            realm: 'gloom',
            type: 'shield',
            path: '/hex-assets/items/base/gloom-shield/gloom-shield-01.png',
          },
          {
            key: 'idol-sword-01',
            origin: 'base',
            realm: 'idol',
            type: 'sword',
            path: '/hex-assets/items/base/idol-sword/idol-sword-01.png',
          },
          {
            key: 'idol-sword-02',
            origin: 'base',
            realm: 'idol',
            type: 'sword',
            path: '/hex-assets/items/base/idol-sword/idol-sword-02.png',
          },
          {
            key: 'ash-crown-blade',
            origin: 'unique',
            realm: null,
            type: null,
            path: '/hex-assets/items/unique/ash-crown-blade.png',
          },
        ],
      },
    });
  });

  it('rejects a name outside the pattern of §7', () => {
    expect(failureCodes(withFile(spriteFile('base/idol-sword/sword-1.png')))).toEqual([
      'NAME_PATTERN',
    ]);
  });

  it('rejects a realm that is not an ERarityKind value', () => {
    expect(failureCodes(withFile(spriteFile('base/fire-sword/fire-sword-01.png')))).toEqual([
      'UNKNOWN_REALM',
    ]);
  });

  it('rejects god-executor in base/', () => {
    const file = spriteFile('base/god-executor-sword/god-executor-sword-01.png');
    expect(failureCodes(withFile(file))).toEqual(['GOD_EXECUTOR_IN_BASE']);
  });

  it('rejects a type that is not in the TypeRegistry', () => {
    expect(failureCodes(withFile(spriteFile('base/idol-hammer/idol-hammer-01.png')))).toEqual([
      'UNKNOWN_TYPE',
    ]);
  });

  it('rejects a size other than 512×512', () => {
    const file = spriteFile('base/idol-axe/idol-axe-01.png', rgbaHeader(1000));
    expect(failureCodes(withFile(file))).toEqual(['WRONG_SIZE']);
  });

  it('rejects a PNG that is not 8-bit RGBA', () => {
    const rgb = { ...rgbaHeader(), colorType: 2 };
    expect(failureCodes(withFile(spriteFile('base/idol-axe/idol-axe-01.png', rgb)))).toEqual([
      'NOT_PNG_RGBA',
    ]);
  });

  it('rejects a file that is not a PNG at all', () => {
    expect(failureCodes(withFile(spriteFile('base/idol-axe/idol-axe-01.png', null)))).toEqual([
      'NOT_PNG_RGBA',
    ]);
  });

  it('rejects a unique key that repeats another key', () => {
    expect(failureCodes(withFile(spriteFile('unique/idol-sword-01.png')))).toEqual([
      'DUPLICATE_KEY',
    ]);
  });

  it('rejects a folder without the placeholder', () => {
    const files = cleanSpriteFiles().filter((file) => file.path !== 'base/_placeholder.png');
    expect(failureCodes(files)).toEqual(['NO_PLACEHOLDER']);
  });

  it('names the file and the rule in every failure message', () => {
    const result = buildSpriteManifest(
      withFile(spriteFile('base/fire-sword/fire-sword-01.png')),
      types,
    );
    expect(result.ok ? [] : result.failures.map((failure) => failure.message)).toEqual([
      'base/fire-sword/fire-sword-01.png: realm "fire" is not one of gloom, idol, spark, god-executor',
    ]);
  });

  it('reports every bad file in one run', () => {
    const files = [
      ...cleanSpriteFiles(),
      spriteFile('base/fire-sword/fire-sword-01.png'),
      spriteFile('base/idol-axe/idol-axe-01.png', rgbaHeader(256)),
      spriteFile('notes.txt', null),
    ];
    expect(failureCodes(files).sort()).toEqual(['NAME_PATTERN', 'UNKNOWN_REALM', 'WRONG_SIZE']);
  });

  it('accepts a new type folder when the type is in the registry, with no code change', () => {
    const files = withFile(spriteFile('base/spark-hammer/spark-hammer-01.png'));
    const result = buildSpriteManifest(files, typesWithHammer());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sprites = new ManifestSpriteRegistry(result.manifest);
    expect(sprites.spritesFor('base', ERarityKind.SPARK, 'hammer').map((ref) => ref.key)).toEqual([
      'spark-hammer-01',
    ]);
  });
});
