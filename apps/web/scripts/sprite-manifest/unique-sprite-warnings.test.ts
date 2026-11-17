import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writePng } from './png-fixture';
import { uniqueSpriteWarnings } from './run-sprite-manifest';

describe('tokens:manifest unique sprite warnings', () => {
  let root: string;
  let itemsDir: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'unique-sprites-'));
    itemsDir = path.join(root, 'items');
    writePng(path.join(itemsDir, 'base/_placeholder.png'));
    writePng(path.join(itemsDir, 'unique/unique-last-verdict.png'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('warns about a unique without its sprite and keeps quiet about the rest', () => {
    expect(uniqueSpriteWarnings({ itemsDir })).toEqual([
      'unique "lantern-eater" has no sprite unique/unique-lantern-eater.png, the placeholder is used',
    ]);
  });

  it('gives no warning when every unique has its sprite', () => {
    expect(uniqueSpriteWarnings({ itemsDir, uniqueKeys: ['last-verdict'] })).toEqual([]);
  });
});
