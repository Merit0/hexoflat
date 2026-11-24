import {
  buildSpriteManifest,
  createTokenRegistries,
  spriteCoverage,
  uniqueSpriteKey,
  type SpriteFailure,
} from '@hexoflat/engine';
import { collectSpriteFiles } from './collect-sprite-files';

export type SpriteCoverageRun =
  { ok: true; lines: string[] } | { ok: false; failures: SpriteFailure[] };

export function runSpriteCoverage(
  itemsDir: string,
  content: Pick<
    ReturnType<typeof createTokenRegistries>,
    'types' | 'uniques'
  > = createTokenRegistries(),
): SpriteCoverageRun {
  const result = buildSpriteManifest(collectSpriteFiles(itemsDir), content);
  if (!result.ok) return result;
  const report = spriteCoverage(result.manifest, content);
  const lines = [
    `base: ${report.pairs - report.missingBase.length} of ${report.pairs} tokenType x type pairs have a sprite`,
    ...report.missingBase.map(({ tokenType, type, uses }) => {
      const used = uses === null ? 'the placeholder' : `${uses}-${type}`;
      return `  missing base/${tokenType}-${type}/ -> ${used}`;
    }),
    `unique: ${report.uniques - report.missingUniques.length} of ${report.uniques} templates have a sprite`,
    ...report.missingUniques.map(
      (key) => `  missing unique/${uniqueSpriteKey(key)}.png -> the placeholder`,
    ),
  ];
  return { ok: true, lines };
}
