import { z } from 'zod';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { TOKEN_TYPES, tokenTypeAllowsTier } from '../dimensions/dimensions';
import {
  baseRealmSchema,
  itemTypeKeySchema,
  uniqueKeySchema,
  type ItemTypeKey,
} from './token-keys';

export const SPRITE_SIZE = 512;
export const SPRITE_ROOT = '/hex-assets/items';
export const PLACEHOLDER_SPRITE_KEY = '_placeholder';
export const PLACEHOLDER_SPRITE_FILE = 'base/_placeholder.png';
export const PNG_HEADER_BYTES = 26;

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const PNG_RGBA_COLOR_TYPE = 6;
const PNG_RGBA_BIT_DEPTH = 8;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BASE_NUMBER = /^(?:0[1-9]|[1-9]\d)$/;
const REALM_VALUES: readonly string[] = TOKEN_TYPES;

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
  origin: z.literal('base'),
  realm: baseRealmSchema,
  type: itemTypeKeySchema,
  path: spritePathSchema,
});

export const uniqueSpriteEntrySchema = z.strictObject({
  key: uniqueKeySchema,
  origin: z.literal('unique'),
  realm: z.null(),
  type: z.null(),
  path: spritePathSchema,
});

export const spriteManifestEntrySchema = z.discriminatedUnion('origin', [
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
  | 'UNKNOWN_REALM'
  | 'ALIEN_IN_BASE'
  | 'UNKNOWN_TYPE'
  | 'WRONG_SIZE'
  | 'NOT_PNG_RGBA'
  | 'DUPLICATE_KEY'
  | 'NO_PLACEHOLDER';

export interface SpriteFailure {
  code: TSpriteFailureCode;
  path: string;
  message: string;
}

export type SpriteManifestResult =
  { ok: true; manifest: SpriteManifest } | { ok: false; failures: SpriteFailure[] };

export interface SpriteTypeLookup {
  has(key: ItemTypeKey): boolean;
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

function realmOf(folder: string): string | null {
  const matches = REALM_VALUES.filter((realm) => folder.startsWith(`${realm}-`));
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}

function nameBaseFile(
  path: string,
  folder: string,
  file: string,
  types: SpriteTypeLookup,
): NamedFile {
  const number = file.startsWith(`${folder}-`) ? file.slice(folder.length + 1, -4) : '';
  if (!SLUG.test(folder) || !file.endsWith('.png') || !BASE_NUMBER.test(number)) {
    return fail(
      'NAME_PATTERN',
      path,
      `expected base/<realm>-<type>/<realm>-<type>-<NN>.png with NN = 01..99`,
    );
  }
  const realm = realmOf(folder);
  if (realm === null) {
    const given = folder.split('-')[0];
    return fail('UNKNOWN_REALM', path, `realm "${given}" is not one of ${REALM_VALUES.join(', ')}`);
  }
  if (!tokenTypeAllowsTier(realm, 'base')) {
    return fail('ALIEN_IN_BASE', path, `${realm} items are unique only, not base`);
  }
  const type = folder.slice(realm.length + 1);
  if (!types.has(type)) {
    return fail('UNKNOWN_TYPE', path, `type "${type}" is not in the TypeRegistry`);
  }
  const entry = {
    key: `${folder}-${number}`,
    origin: 'base',
    realm,
    type,
    path: `${SPRITE_ROOT}/${path}`,
  };
  return { kind: 'entry', entry: baseSpriteEntrySchema.parse(entry) };
}

function nameUniqueFile(path: string, file: string): NamedFile {
  const key = file.endsWith('.png') ? file.slice(0, -4) : '';
  if (!SLUG.test(key)) {
    return fail('NAME_PATTERN', path, `expected unique/<uniqueKey>.png with a lower-case slug key`);
  }
  const entry = { key, origin: 'unique', realm: null, type: null, path: `${SPRITE_ROOT}/${path}` };
  return { kind: 'entry', entry: uniqueSpriteEntrySchema.parse(entry) };
}

function nameFile(path: string, types: SpriteTypeLookup): NamedFile {
  const segments = path.split('/');
  if (path === PLACEHOLDER_SPRITE_FILE) return { kind: 'placeholder' };
  if (segments.length === 3 && segments[0] === 'base') {
    return nameBaseFile(path, segments[1], segments[2], types);
  }
  if (segments.length === 2 && segments[0] === 'unique') return nameUniqueFile(path, segments[1]);
  return fail(
    'NAME_PATTERN',
    path,
    `expected base/<realm>-<type>/<realm>-<type>-<NN>.png or unique/<uniqueKey>.png`,
  );
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

export function buildSpriteManifest(
  files: readonly SpriteFile[],
  types: SpriteTypeLookup,
): SpriteManifestResult {
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const failures: SpriteFailure[] = [];
  const entries: SpriteManifestEntry[] = [];
  let placeholder = false;
  for (const file of sorted) {
    const named = nameFile(file.path, types);
    if (named.kind === 'failure') failures.push(named.failure);
    if (named.kind === 'entry') entries.push(named.entry);
    if (named.kind === 'placeholder') placeholder = true;
    if (named.kind !== 'failure') failures.push(...imageFailures(file));
  }
  failures.push(...duplicateFailures(entries));
  if (!placeholder) {
    const message = `${PLACEHOLDER_SPRITE_FILE}: the placeholder sprite is missing`;
    failures.push({ code: 'NO_PLACEHOLDER', path: PLACEHOLDER_SPRITE_FILE, message });
  }
  if (failures.length > 0) return { ok: false, failures };
  const manifest = { placeholder: `${SPRITE_ROOT}/${PLACEHOLDER_SPRITE_FILE}`, entries };
  return { ok: true, manifest: spriteManifestSchema.parse(manifest) };
}

function realmSource(realm: ERarityKind | null): string {
  if (realm === null) return 'null';
  const member = Object.entries(ERarityKind).find(([, value]) => value === realm);
  return `ERarityKind.${member?.[0] ?? ''}`;
}

function entrySource(entry: SpriteManifestEntry): string {
  return [
    '    {',
    `      key: '${entry.key}',`,
    `      origin: '${entry.origin}',`,
    `      realm: ${realmSource(entry.realm)},`,
    `      type: ${entry.type === null ? 'null' : `'${entry.type}'`},`,
    `      path: '${entry.path}',`,
    '    },',
  ].join('\n');
}

export function spriteManifestSource(manifest: SpriteManifest): string {
  const entries = manifest.entries.map(entrySource);
  const usesRealm = manifest.entries.some((entry) => entry.realm !== null);
  return [
    ...(usesRealm ? [`import { ERarityKind } from '../abstraction/hexobject-abstraction';`] : []),
    `import type { SpriteManifest } from './sprite-files';`,
    '',
    'export const SPRITE_MANIFEST: SpriteManifest = {',
    `  placeholder: '${manifest.placeholder}',`,
    entries.length === 0 ? '  entries: [],' : ['  entries: [', ...entries, '  ],'].join('\n'),
    '};',
    '',
  ].join('\n');
}
