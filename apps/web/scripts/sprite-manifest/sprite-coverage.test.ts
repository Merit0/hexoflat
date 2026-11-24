import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writePng } from './png-fixture';
import { runSpriteCoverage } from './run-sprite-coverage';
import { runSpriteManifest } from './run-sprite-manifest';

describe('sprites:coverage on a fixture folder', () => {
  let root: string;
  let itemsDir: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'sprite-coverage-'));
    itemsDir = path.join(root, 'items');
    writePng(path.join(itemsDir, 'base/_placeholder.png'));
    writePng(path.join(itemsDir, 'base/idol-sword/idol-sword-01.png'));
    writePng(path.join(itemsDir, 'unique/last-verdict.png'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('lists missing pairs with what is used instead, and missing unique files', () => {
    const result = runSpriteCoverage(itemsDir);
    if (!result.ok) throw new Error('the fixture folder is invalid');
    expect(result.lines[0]).toBe('base: 1 of 12 tokenType x type pairs have a sprite');
    expect(result.lines).toContain('  missing base/gloom-sword/ -> idol-sword');
    expect(result.lines).toContain('  missing base/idol-axe/ -> the placeholder');
    expect(result.lines.slice(-2)).toEqual([
      'unique: 1 of 2 templates have a sprite',
      '  missing unique/lantern-eater.png -> the placeholder',
    ]);
  });

  it('refuses a folder with an invalid file instead of reporting coverage', () => {
    writePng(path.join(itemsDir, 'unique/nobody.png'));
    expect(runSpriteCoverage(itemsDir)).toMatchObject({
      ok: false,
      failures: [{ code: 'ORPHAN_UNIQUE', path: 'unique/nobody.png' }],
    });
  });

  it('tokens:manifest lists only the uniques with pending art as warnings', () => {
    const run = runSpriteManifest({ itemsDir, outFile: path.join(root, 'manifest.ts') });
    expect(run).toMatchObject({
      ok: true,
      warnings: [{ code: 'UNIQUE_ART_PENDING', path: 'unique/lantern-eater.png' }],
    });
  });
});
