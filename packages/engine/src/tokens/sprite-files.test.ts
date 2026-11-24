import { describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { tokenTypeAllowsTier } from '../dimensions/dimensions';
import {
  buildSpriteManifest,
  readPngHeader,
  validateSpriteFiles,
  type SpriteFile,
  type TSpriteFailureCode,
} from './sprite-files';
import { ManifestSpriteRegistry } from './sprite-registry';
import {
  cleanSpriteFiles,
  pngHeaderBytes,
  rgbaHeader,
  spriteCatalogue,
  spriteFile,
  typesWithHammer,
} from './sprite-test-setup';

const catalogue = spriteCatalogue();

function failureCodes(files: SpriteFile[], content = catalogue): TSpriteFailureCode[] {
  const result = buildSpriteManifest(files, content);
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
    const result = buildSpriteManifest(cleanSpriteFiles(), catalogue);
    expect(result).toEqual({
      ok: true,
      gaps: [],
      manifest: {
        placeholder: '/hex-assets/items/base/_placeholder.png',
        entries: [
          {
            key: 'gloom-shield-01',
            tier: 'base',
            tokenType: 'gloom',
            type: 'shield',
            path: '/hex-assets/items/base/gloom-shield/gloom-shield-01.png',
          },
          {
            key: 'idol-sword-01',
            tier: 'base',
            tokenType: 'idol',
            type: 'sword',
            path: '/hex-assets/items/base/idol-sword/idol-sword-01.png',
          },
          {
            key: 'idol-sword-02',
            tier: 'base',
            tokenType: 'idol',
            type: 'sword',
            path: '/hex-assets/items/base/idol-sword/idol-sword-02.png',
          },
          {
            key: 'ash-crown-blade',
            tier: 'unique',
            tokenType: null,
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

  it('rejects a tokenType that is not an ETokenType value', () => {
    expect(failureCodes(withFile(spriteFile('base/fire-sword/fire-sword-01.png')))).toEqual([
      'UNKNOWN_REALM',
    ]);
  });

  it('rejects alien in base/', () => {
    const file = spriteFile('base/alien-sword/alien-sword-01.png');
    expect(failureCodes(withFile(file))).toEqual(['ALIEN_IN_BASE']);
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

  it('rejects a folder without the placeholder', () => {
    const files = cleanSpriteFiles().filter((file) => file.path !== 'base/_placeholder.png');
    expect(failureCodes(files)).toEqual(['NO_PLACEHOLDER']);
  });

  it('names the file and the rule in every failure message', () => {
    const result = buildSpriteManifest(
      withFile(spriteFile('base/fire-sword/fire-sword-01.png')),
      catalogue,
    );
    expect(result.ok ? [] : result.failures.map((failure) => failure.message)).toEqual([
      'base/fire-sword/fire-sword-01.png: tokenType "fire" is not one of gloom, idol, spark, alien',
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
    const result = buildSpriteManifest(files, spriteCatalogue(undefined, typesWithHammer()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sprites = new ManifestSpriteRegistry(result.manifest);
    expect(sprites.spritesFor('base', ETokenType.SPARK, 'hammer').map((ref) => ref.key)).toEqual([
      'spark-hammer-01',
    ]);
  });
});

function reported(files: SpriteFile[], content = catalogue) {
  return validateSpriteFiles(files, content).map((failure) => [failure.code, failure.path]);
}

describe('DA4-1: base path rules', () => {
  it('accepts base/<tokenType>-<type>/<tokenType>-<type>-NN.png of every base token type', () => {
    const files = ['gloom', 'idol', 'spark'].flatMap((tokenType) =>
      ['01', '10', '99'].map((n) => spriteFile(`base/${tokenType}-axe/${tokenType}-axe-${n}.png`)),
    );
    expect(reported([...cleanSpriteFiles(), ...files])).toEqual([]);
  });

  it.each([
    'base/alien-sword/alien-sword-01.png',
    'base/alien-hammer/alien-hammer-01.png',
    'base/alien-sword/whatever.png',
    'base/alien-sword/deep/alien-sword-01.png',
    'base/alien-sword-01.png',
  ])('refuses %s with ALIEN_IN_BASE', (path) => {
    expect(reported(withFile(spriteFile(path)))).toEqual([['ALIEN_IN_BASE', path]]);
  });

  it('asks the Dimension record, not a literal, whether a token type has the base tier', () => {
    const noIdolBase = (tokenType: string, tier: 'base' | 'unique') =>
      tokenType !== 'idol' && tokenTypeAllowsTier(tokenType, tier);
    expect(
      validateSpriteFiles(cleanSpriteFiles(), catalogue, noIdolBase).map((f) => [f.code, f.path]),
    ).toEqual([
      ['ALIEN_IN_BASE', 'base/idol-sword/idol-sword-01.png'],
      ['ALIEN_IN_BASE', 'base/idol-sword/idol-sword-02.png'],
    ]);
  });

  it.each(['base/idol-axe/idol-sword-03.png', 'base/idol-axe/gloom-axe-01.png'])(
    'refuses %s: the folder and the file prefix differ',
    (path) => {
      expect(reported(withFile(spriteFile(path)))).toEqual([['PREFIX_MISMATCH', path]]);
    },
  );

  it.each(['1', '001', '00', 'ab', ''])('refuses the number "%s": NN is 01..99', (n) => {
    const path = `base/idol-axe/idol-axe-${n}.png`;
    expect(reported(withFile(spriteFile(path)))).toEqual([['NAME_PATTERN', path]]);
  });

  it.each([
    'base/idol-axe/idol-axe-01.jpg',
    'base/idol-axe/deep/idol-axe-01.png',
    'base/idol-axe-01.png',
    'axe.png',
  ])('refuses %s: outside the folder shape', (path) => {
    expect(reported(withFile(spriteFile(path)))).toEqual([['NAME_PATTERN', path]]);
  });

  it('refuses an unknown item type of a known token type', () => {
    const path = 'base/spark-hammer/spark-hammer-01.png';
    expect(reported(withFile(spriteFile(path)))).toEqual([['UNKNOWN_TYPE', path]]);
  });
});

describe('DA4-1: one pixel size', () => {
  it('accepts base sprites of one size', () => {
    const files = ['01', '02', '03'].map((n) => spriteFile(`base/idol-axe/idol-axe-${n}.png`));
    expect(reported([...cleanSpriteFiles(), ...files])).toEqual([]);
  });

  it.each([
    [256, 256],
    [512, 511],
    [1024, 1024],
  ])('reports only the odd %i×%i file', (width, height) => {
    const odd = 'base/idol-axe/idol-axe-02.png';
    const files = [
      ...cleanSpriteFiles(),
      spriteFile('base/idol-axe/idol-axe-01.png'),
      spriteFile(odd, rgbaHeader(width, height)),
      spriteFile('base/idol-axe/idol-axe-03.png'),
    ];
    expect(reported(files)).toEqual([['WRONG_SIZE', odd]]);
  });

  it('reads the size from the IHDR bytes', () => {
    const odd = 'base/idol-axe/idol-axe-01.png';
    const header = readPngHeader(pngHeaderBytes(rgbaHeader(300, 512)));
    expect(validateSpriteFiles(withFile(spriteFile(odd, header)), catalogue)).toEqual([
      { code: 'WRONG_SIZE', path: odd, message: `${odd}: size is 300×512, expected 512×512` },
    ]);
  });
});

describe('DA4-1: unique files and templates', () => {
  const withoutUnique = cleanSpriteFiles().filter((file) => !file.path.startsWith('unique/'));

  it('accepts unique/<key>.png of a template', () => {
    expect(reported(cleanSpriteFiles())).toEqual([]);
  });

  it('reports a template without its file and still builds the manifest', () => {
    expect(reported(withoutUnique)).toEqual([
      ['UNIQUE_FILE_MISSING', 'unique/ash-crown-blade.png'],
    ]);
    const result = buildSpriteManifest(withoutUnique, catalogue);
    expect(result.ok && result.gaps.map((gap) => gap.path)).toEqual(['unique/ash-crown-blade.png']);
  });

  it.each(['unique/nobody.png', 'unique/unique-ash-crown-blade.png'])(
    'refuses the orphan %s',
    (path) => {
      expect(reported(withFile(spriteFile(path)))).toEqual([['ORPHAN_UNIQUE', path]]);
    },
  );

  it.each(['unique/Ash.png', 'unique/ash-crown-blade.webp', 'unique/deep/ash-crown-blade.png'])(
    'refuses %s: not unique/<slug>.png',
    (path) => {
      expect(reported(withFile(spriteFile(path)))).toEqual([['NAME_PATTERN', path]]);
    },
  );

  it.each(['gloom', 'idol', 'spark', 'alien'])('accepts a %s template', (tokenType) => {
    const content = spriteCatalogue([{ key: 'ash-crown-blade', tokenType }]);
    expect(reported(cleanSpriteFiles(), content)).toEqual([]);
  });

  it('refuses a template whose token type has no unique tier in the record', () => {
    const noUnique = (tokenType: string, tier: 'base' | 'unique') =>
      tier !== 'unique' && tokenTypeAllowsTier(tokenType, tier);
    expect(
      validateSpriteFiles(cleanSpriteFiles(), catalogue, noUnique).map((f) => [f.code, f.path]),
    ).toEqual([['UNIQUE_TIER_NOT_ALLOWED', 'unique/ash-crown-blade.png']]);
    const unknown = spriteCatalogue([{ key: 'ash-crown-blade', tokenType: 'mythic' }]);
    expect(reported(cleanSpriteFiles(), unknown)).toEqual([
      ['UNIQUE_TIER_NOT_ALLOWED', 'unique/ash-crown-blade.png'],
    ]);
  });

  it('rejects a unique key that repeats another key', () => {
    const content = spriteCatalogue([
      { key: 'ash-crown-blade', tokenType: 'gloom' },
      { key: 'idol-sword-01', tokenType: 'idol' },
    ]);
    expect(failureCodes(withFile(spriteFile('unique/idol-sword-01.png')), content)).toEqual([
      'DUPLICATE_KEY',
    ]);
  });

  it('reports refusals and missing unique files together', () => {
    const files = [...withoutUnique, spriteFile('unique/nobody.png')];
    expect(reported(files)).toEqual([
      ['ORPHAN_UNIQUE', 'unique/nobody.png'],
      ['UNIQUE_FILE_MISSING', 'unique/ash-crown-blade.png'],
    ]);
  });
});
