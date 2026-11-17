import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildSpriteManifest,
  createTokenRegistries,
  spriteManifestSource,
  type SpriteFailure,
  type SpriteTypeLookup,
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
