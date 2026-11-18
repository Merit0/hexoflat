import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSpriteManifest,
  createTokenRegistries,
  ManifestSpriteRegistry,
  uniqueSpriteKey,
  spriteManifestSource,
  type SpriteFailure,
  type SpriteTypeLookup,
  type UniqueKey,
} from '@hexoflat/engine';
import { collectSpriteFiles } from './collect-sprite-files';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ITEMS_DIR = path.resolve(here, '../../public/hex-assets/items');
export const MANIFEST_FILE = path.resolve(
  here,
  '../../../../packages/engine/src/tokens/sprite-manifest.ts',
);

export interface SpriteManifestRun {
  itemsDir: string;
  outFile: string;
  types?: SpriteTypeLookup;
}

export type SpriteManifestRunResult =
  { ok: true; count: number; changed: boolean } | { ok: false; failures: SpriteFailure[] };

export function runSpriteManifest(run: SpriteManifestRun): SpriteManifestRunResult {
  const types = run.types ?? createTokenRegistries().types;
  const result = buildSpriteManifest(collectSpriteFiles(run.itemsDir), types);
  if (!result.ok) return result;
  const source = spriteManifestSource(result.manifest);
  const changed = !existsSync(run.outFile) || readFileSync(run.outFile, 'utf-8') !== source;
  if (changed) writeFileSync(run.outFile, source);
  return { ok: true, count: result.manifest.entries.length, changed };
}

export interface UniqueSpriteCheck {
  itemsDir: string;
  uniqueKeys?: readonly UniqueKey[];
  types?: SpriteTypeLookup;
}

export function uniqueSpriteWarnings(check: UniqueSpriteCheck): string[] {
  const registries = createTokenRegistries();
  const types = check.types ?? registries.types;
  const uniqueKeys = check.uniqueKeys ?? registries.uniques.all().map((unique) => unique.key);
  const result = buildSpriteManifest(collectSpriteFiles(check.itemsDir), types);
  if (!result.ok) return [];
  return new ManifestSpriteRegistry(result.manifest)
    .missingUniqueSprites(uniqueKeys)
    .map(
      (key) =>
        `unique "${key}" has no sprite unique/${uniqueSpriteKey(key)}.png, the placeholder is used`,
    );
}
