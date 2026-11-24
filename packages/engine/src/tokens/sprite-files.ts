import { z } from 'zod';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { TOKEN_TYPES, tokenTypeAllowsTier, type TTokenTier } from '../dimensions/dimensions';
import {
  PLACEHOLDER_SPRITE_KEY,
  baseTokenTypeSchema,
  itemTypeKeySchema,
  uniqueKeySchema,
  uniqueSpriteKey,
  type ItemTypeKey,
  type UniqueKey,
} from './token-keys';
import type { TUniqueArt } from './unique-schema';

export const SPRITE_SIZE = 512;
export const SPRITE_ROOT = '/hex-assets/items';
export const PLACEHOLDER_SPRITE_FILE = `base/${PLACEHOLDER_SPRITE_KEY}.png`;
export const PNG_HEADER_BYTES = 26;

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const PNG_RGBA_COLOR_TYPE = 6;
const PNG_RGBA_BIT_DEPTH = 8;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BASE_FILE = /^(.+)-(?:0[1-9]|[1-9]\d)\.png$/;
const BASE_SHAPE = 'expected base/<tokenType>-<type>/<tokenType>-<type>-<NN>.png with NN = 01..99';
const TOKEN_TYPE_VALUES: readonly string[] = TOKEN_TYPES;

export interface PngHeader {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
}

export interface SpriteFile {
  path: string;
  header: PngHeader | null;
}

const spritePathSchema = z.string().startsWith(`${SPRITE_ROOT}/`);

export const baseSpriteEntrySchema = z.strictObject({
  key: z.string().regex(SLUG),
  tier: z.literal('base'),
  tokenType: baseTokenTypeSchema,
  type: itemTypeKeySchema,
  path: spritePathSchema,
});

export const uniqueSpriteEntrySchema = z.strictObject({
  key: uniqueKeySchema,
  tier: z.literal('unique'),
  tokenType: z.null(),
  type: z.null(),
  path: spritePathSchema,
});

export const spriteManifestEntrySchema = z.discriminatedUnion('tier', [
  baseSpriteEntrySchema,
  uniqueSpriteEntrySchema,
]);

export const spriteManifestSchema = z.strictObject({
  placeholder: spritePathSchema,
  entries: z.array(spriteManifestEntrySchema),
});

export type SpriteManifestEntry = z.infer<typeof spriteManifestEntrySchema>;
export type SpriteManifest = z.infer<typeof spriteManifestSchema>;

export type TSpriteFailureCode =
  | 'NAME_PATTERN'
  | 'PREFIX_MISMATCH'
  | 'UNKNOWN_TOKEN_TYPE'
  | 'ALIEN_IN_BASE'
  | 'UNKNOWN_TYPE'
  | 'WRONG_SIZE'
  | 'NOT_PNG_RGBA'
  | 'DUPLICATE_KEY'
  | 'ORPHAN_UNIQUE'
  | 'UNIQUE_FILE_MISSING'
  | 'UNIQUE_ART_PENDING'
  | 'UNIQUE_TIER_NOT_ALLOWED'
  | 'NO_PLACEHOLDER';

export interface SpriteFailure {
  code: TSpriteFailureCode;
  path: string;
  message: string;
}

export type SpriteManifestResult =
  | { ok: true; manifest: SpriteManifest; warnings: SpriteFailure[] }
  | { ok: false; failures: SpriteFailure[] };

export interface SpriteTypeLookup {
  has(key: ItemTypeKey): boolean;
}

export interface SpriteUniqueTemplate {
  key: UniqueKey;
  tokenType: string;
  art: TUniqueArt;
}

export interface SpriteCatalogue {
  types: SpriteTypeLookup;
  uniques: { has(key: UniqueKey): boolean; all(): readonly SpriteUniqueTemplate[] };
}

export type AllowsTier = (tokenType: string, tier: TTokenTier) => boolean;

interface SpriteRules {
  catalogue: SpriteCatalogue;
  allowsTier: AllowsTier;
}

type NamedFile =
  | { kind: 'placeholder' }
  | { kind: 'entry'; entry: SpriteManifestEntry }
  | { kind: 'failure'; failure: SpriteFailure };

function readUint32(bytes: Uint8Array, at: number): number {
  return ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
}

export function readPngHeader(bytes: Uint8Array): PngHeader | null {
  if (bytes.length < PNG_HEADER_BYTES) return null;
  if (PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) return null;
  const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (readUint32(bytes, 8) !== 13 || chunkType !== 'IHDR') return null;
  return {
    width: readUint32(bytes, 16),
    height: readUint32(bytes, 20),
    bitDepth: bytes[24],
    colorType: bytes[25],
  };
}

function fail(code: TSpriteFailureCode, path: string, message: string): NamedFile {
  return { kind: 'failure', failure: { code, path, message: `${path}: ${message}` } };
}

function tokenTypeOfFolder(folder: string): string | null {
  const matches = TOKEN_TYPE_VALUES.filter((tokenType) => folder.startsWith(`${tokenType}-`));
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}

function nameBaseFile(path: string, folder: string, file: string, rules: SpriteRules): NamedFile {
  const tokenType = tokenTypeOfFolder(folder);
  if (tokenType !== null && !rules.allowsTier(tokenType, 'base')) {
    return fail('ALIEN_IN_BASE', path, `${tokenType} items are unique only, not base`);
  }
  const prefix = BASE_FILE.exec(file)?.[1];
  if (!SLUG.test(folder) || prefix === undefined) return fail('NAME_PATTERN', path, BASE_SHAPE);
  if (tokenType === null) {
    const given = folder.split('-')[0];
    return fail(
      'UNKNOWN_TOKEN_TYPE',
      path,
      `tokenType "${given}" is not one of ${TOKEN_TYPE_VALUES.join(', ')}`,
    );
  }
  if (prefix !== folder) {
    return fail('PREFIX_MISMATCH', path, `file prefix "${prefix}" differs from folder "${folder}"`);
  }
  const type = folder.slice(tokenType.length + 1);
  if (!rules.catalogue.types.has(type)) {
    return fail('UNKNOWN_TYPE', path, `type "${type}" is not in the TypeRegistry`);
  }
  const entry = {
    key: file.slice(0, -4),
    tier: 'base',
    tokenType,
    type,
    path: `${SPRITE_ROOT}/${path}`,
  };
  return { kind: 'entry', entry: baseSpriteEntrySchema.parse(entry) };
}

function nameUniqueFile(path: string, file: string, rules: SpriteRules): NamedFile {
  const key = file.endsWith('.png') ? file.slice(0, -4) : '';
  if (!SLUG.test(key)) {
    return fail('NAME_PATTERN', path, `expected unique/<uniqueKey>.png with a lower-case slug key`);
  }
  if (!rules.catalogue.uniques.has(key)) {
    return fail('ORPHAN_UNIQUE', path, `no unique template has the key "${key}"`);
  }
  const entry = {
    key,
    tier: 'unique',
    tokenType: null,
    type: null,
    path: `${SPRITE_ROOT}/${path}`,
  };
  return { kind: 'entry', entry: uniqueSpriteEntrySchema.parse(entry) };
}

function nameFile(path: string, rules: SpriteRules): NamedFile {
  const segments = path.split('/');
  if (path === PLACEHOLDER_SPRITE_FILE) return { kind: 'placeholder' };
  if (segments[0] === 'base' && segments.length > 1) {
    const [, folder, ...rest] = segments;
    return nameBaseFile(path, folder, rest.length === 1 ? rest[0] : '', rules);
  }
  if (segments.length === 2 && segments[0] === 'unique') {
    return nameUniqueFile(path, segments[1], rules);
  }
  return fail('NAME_PATTERN', path, `${BASE_SHAPE} or unique/<uniqueKey>.png`);
}

function imageFailures(file: SpriteFile): SpriteFailure[] {
  const { header, path } = file;
  if (
    header === null ||
    header.bitDepth !== PNG_RGBA_BIT_DEPTH ||
    header.colorType !== PNG_RGBA_COLOR_TYPE
  ) {
    return [
      { code: 'NOT_PNG_RGBA', path, message: `${path}: expected an 8-bit RGBA PNG (color type 6)` },
    ];
  }
  if (header.width !== SPRITE_SIZE || header.height !== SPRITE_SIZE) {
    const size = `${header.width}×${header.height}`;
    const message = `${path}: size is ${size}, expected ${SPRITE_SIZE}×${SPRITE_SIZE}`;
    return [{ code: 'WRONG_SIZE', path, message }];
  }
  return [];
}

function duplicateFailures(entries: readonly SpriteManifestEntry[]): SpriteFailure[] {
  const firstPath = new Map<string, string>([[PLACEHOLDER_SPRITE_KEY, PLACEHOLDER_SPRITE_FILE]]);
  const failures: SpriteFailure[] = [];
  for (const entry of entries) {
    const path = entry.path.slice(SPRITE_ROOT.length + 1);
    const earlier = firstPath.get(entry.key);
    if (earlier === undefined) {
      firstPath.set(entry.key, path);
      continue;
    }
    const message = `${path}: key "${entry.key}" repeats the key of ${earlier}`;
    failures.push({ code: 'DUPLICATE_KEY', path, message });
  }
  return failures;
}

function templateFailures(rules: SpriteRules): SpriteFailure[] {
  return rules.catalogue.uniques
    .all()
    .filter((unique) => !rules.allowsTier(unique.tokenType, 'unique'))
    .map((unique) => {
      const path = `unique/${uniqueSpriteKey(unique.key)}.png`;
      const message = `${path}: ${unique.tokenType} tokens have no unique tier`;
      return { code: 'UNIQUE_TIER_NOT_ALLOWED', path, message };
    });
}

function missingUniques(
  files: readonly SpriteFile[],
  catalogue: SpriteCatalogue,
  art: TUniqueArt,
): SpriteFailure[] {
  const paths = new Set(files.map((file) => file.path));
  return catalogue.uniques.all().flatMap((unique): SpriteFailure[] => {
    const path = `unique/${uniqueSpriteKey(unique.key)}.png`;
    if (unique.art !== art || paths.has(path)) return [];
    const message = `${path}: unique "${unique.key}" has no sprite file, the placeholder is used`;
    return [
      { code: art === 'ready' ? 'UNIQUE_FILE_MISSING' : 'UNIQUE_ART_PENDING', path, message },
    ];
  });
}

export function buildSpriteManifest(
  files: readonly SpriteFile[],
  catalogue: SpriteCatalogue,
  allowsTier: AllowsTier = tokenTypeAllowsTier,
): SpriteManifestResult {
  const rules: SpriteRules = { catalogue, allowsTier };
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const failures: SpriteFailure[] = [];
  const entries: SpriteManifestEntry[] = [];
  let placeholder = false;
  for (const file of sorted) {
    const named = nameFile(file.path, rules);
    if (named.kind === 'failure') failures.push(named.failure);
    if (named.kind === 'entry') entries.push(named.entry);
    if (named.kind === 'placeholder') placeholder = true;
    if (named.kind !== 'failure') failures.push(...imageFailures(file));
  }
  failures.push(
    ...duplicateFailures(entries),
    ...templateFailures(rules),
    ...missingUniques(sorted, catalogue, 'ready'),
  );
  if (!placeholder) {
    const message = `${PLACEHOLDER_SPRITE_FILE}: the placeholder sprite is missing`;
    failures.push({ code: 'NO_PLACEHOLDER', path: PLACEHOLDER_SPRITE_FILE, message });
  }
  if (failures.length > 0) return { ok: false, failures };
  const manifest = { placeholder: `${SPRITE_ROOT}/${PLACEHOLDER_SPRITE_FILE}`, entries };
  return {
    ok: true,
    manifest: spriteManifestSchema.parse(manifest),
    warnings: missingUniques(sorted, catalogue, 'pending'),
  };
}

export function validateSpriteFiles(
  files: readonly SpriteFile[],
  catalogue: SpriteCatalogue,
  allowsTier: AllowsTier = tokenTypeAllowsTier,
): SpriteFailure[] {
  const result = buildSpriteManifest(files, catalogue, allowsTier);
  const failures = result.ok ? [] : result.failures;
  return [...failures, ...missingUniques(files, catalogue, 'pending')];
}

function tokenTypeSource(tokenType: ETokenType | null): string {
  if (tokenType === null) return 'null';
  const member = Object.entries(ETokenType).find(([, value]) => value === tokenType);
  return `ETokenType.${member?.[0] ?? ''}`;
}

function entrySource(entry: SpriteManifestEntry): string {
  return [
    '    {',
    `      key: '${entry.key}',`,
    `      tier: '${entry.tier}',`,
    `      tokenType: ${tokenTypeSource(entry.tokenType)},`,
    `      type: ${entry.type === null ? 'null' : `'${entry.type}'`},`,
    `      path: '${entry.path}',`,
    '    },',
  ].join('\n');
}

export function spriteManifestSource(manifest: SpriteManifest): string {
  const entries = manifest.entries.map(entrySource);
  const usesTokenType = manifest.entries.some((entry) => entry.tokenType !== null);
  return [
    ...(usesTokenType
      ? [`import { ETokenType } from '../abstraction/hexobject-abstraction';`]
      : []),
    `import type { SpriteManifest } from './sprite-files';`,
    '',
    'export const SPRITE_MANIFEST: SpriteManifest = {',
    `  placeholder: '${manifest.placeholder}',`,
    entries.length === 0 ? '  entries: [],' : ['  entries: [', ...entries, '  ],'].join('\n'),
    '};',
    '',
  ].join('\n');
}
