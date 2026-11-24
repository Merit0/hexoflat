import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildSpriteManifest,
  createTokenRegistries,
  ITEM_TYPES,
  SPRITE_MANIFEST,
  SPRITE_SIZE,
  spriteManifestSource,
  TypeRegistry,
  validateSpriteFiles,
} from '@hexoflat/engine';
import { collectSpriteFiles } from './collect-sprite-files';
import { writePng } from './png-fixture';
import { ITEMS_DIR, MANIFEST_FILE, runSpriteManifest } from './run-sprite-manifest';

const catalogue = createTokenRegistries();

describe('TG-10: item sprites in apps/web/public/hex-assets/items', () => {
  const files = collectSpriteFiles(ITEMS_DIR);
  const result = buildSpriteManifest(files, catalogue);

  it('every file follows the name pattern and is a 512×512 RGBA PNG', () => {
    expect(result.ok ? [] : result.failures.map((failure) => failure.message)).toEqual([]);
    for (const file of files) {
      expect(file.header).toEqual({
        width: SPRITE_SIZE,
        height: SPRITE_SIZE,
        bitDepth: 8,
        colorType: 6,
      });
    }
  });

  it('DA4-2: the real folder has no violations, only the two uniques with pending art', () => {
    expect(
      validateSpriteFiles(files, catalogue).map(({ code, path: file }) => [code, file]),
    ).toEqual([
      ['UNIQUE_ART_PENDING', 'unique/lantern-eater.png'],
      ['UNIQUE_ART_PENDING', 'unique/last-verdict.png'],
    ]);
  });

  it('the committed manifest equals the folders', () => {
    if (!result.ok) throw new Error('the sprite folders are invalid');
    expect(SPRITE_MANIFEST).toEqual(result.manifest);
    expect(readFileSync(MANIFEST_FILE, 'utf-8')).toBe(spriteManifestSource(result.manifest));
  });

  it('every item type has its idol sprite, and the old sprites are still in place', () => {
    const keys = SPRITE_MANIFEST.entries.map((entry) => entry.key);
    expect(keys).toEqual(expect.arrayContaining(ITEM_TYPES.map((type) => `idol-${type.key}-01`)));
    const publicDir = path.resolve(ITEMS_DIR, '../..');
    for (const old of [
      'hex-assets/hex-loot/sword-hex.png',
      'hex-assets/hex-loot/axe-token.png',
      'hex-assets/hex-tools/pickaxe-token-image.png',
      'hex-assets/hex-equipment/hex-weapons/hex-shield/shield-token-image.png',
    ]) {
      expect(existsSync(path.join(publicDir, old))).toBe(true);
    }
  });
});

describe('runSpriteManifest on a fixture folder', () => {
  let root: string;
  let itemsDir: string;
  let outFile: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'sprite-manifest-'));
    itemsDir = path.join(root, 'items');
    outFile = path.join(root, 'sprite-manifest.ts');
    writePng(path.join(itemsDir, 'base/_placeholder.png'));
    writePng(path.join(itemsDir, 'base/idol-sword/idol-sword-01.png'));
    writeFileSync(path.join(root, 'items/.DS_Store'), '');
    writeFileSync(path.join(root, 'items/base/.gitkeep'), '');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('writes the manifest and ignores hidden files', () => {
    expect(runSpriteManifest({ itemsDir, outFile, catalogue })).toEqual({
      ok: true,
      count: 1,
      changed: true,
      warnings: [
        expect.objectContaining({ code: 'UNIQUE_ART_PENDING', path: 'unique/lantern-eater.png' }),
        expect.objectContaining({ code: 'UNIQUE_ART_PENDING', path: 'unique/last-verdict.png' }),
      ],
    });
    expect(readFileSync(outFile, 'utf-8')).toContain(`key: 'idol-sword-01'`);
    expect(runSpriteManifest({ itemsDir, outFile, catalogue })).toMatchObject({ changed: false });
  });

  it('fails with a clear message and writes nothing when a sprite is wrong', () => {
    writePng(path.join(itemsDir, 'base/idol-axe/idol-axe-01.png'), 256);
    writePng(path.join(itemsDir, 'base/idol-shield/idol-shield-01.png'), 512, 2);
    expect(runSpriteManifest({ itemsDir, outFile, catalogue })).toEqual({
      ok: false,
      failures: [
        {
          code: 'WRONG_SIZE',
          path: 'base/idol-axe/idol-axe-01.png',
          message: 'base/idol-axe/idol-axe-01.png: size is 256×256, expected 512×512',
        },
        {
          code: 'NOT_PNG_RGBA',
          path: 'base/idol-shield/idol-shield-01.png',
          message: 'base/idol-shield/idol-shield-01.png: expected an 8-bit RGBA PNG (color type 6)',
        },
      ],
    });
    expect(existsSync(outFile)).toBe(false);
  });

  it('takes a new type folder with no code change once the type is registered', () => {
    writePng(path.join(itemsDir, 'base/gloom-hammer/gloom-hammer-01.png'));
    expect(runSpriteManifest({ itemsDir, outFile, catalogue })).toMatchObject({ ok: false });
    const withHammer = new TypeRegistry([
      ...ITEM_TYPES,
      { ...ITEM_TYPES[0], key: 'hammer', nounKey: 'content.tokens.noun.hammer' },
    ]);
    expect(
      runSpriteManifest({ itemsDir, outFile, catalogue: { ...catalogue, types: withHammer } }),
    ).toMatchObject({
      ok: true,
      count: 2,
    });
    expect(readFileSync(outFile, 'utf-8')).toContain(`type: 'hammer'`);
  });
});
