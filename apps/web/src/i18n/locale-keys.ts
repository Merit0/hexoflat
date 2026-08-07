import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CONTENT } from '@hexoflat/engine';

const CONTENT_KEY_PREFIX = 'content.';

// apps/web/src — everything these helpers scan/collect against lives under
// here. Resolved from cwd (vitest/turbo always run this package's scripts
// with apps/web as the working directory) rather than import.meta.url,
// which Vitest's transform pipeline can rewrite to a non-file:// URL.
const SRC_DIR = resolve(process.cwd(), 'src');

export function getByPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === 'object' && segment in acc) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, source);
}

// Only fields that were actually migrated to i18n keys use the
// 'content.<key>.*' convention — everything else in CONTENT is still raw
// English text (out of scope for this vertical slice) and is skipped here.
export function collectContentLocaleKeys(): string[] {
  const keys = new Set<string>();

  for (const def of Object.values(CONTENT)) {
    if (def.title.startsWith(CONTENT_KEY_PREFIX)) keys.add(def.title);
    if (def.subtitle?.startsWith(CONTENT_KEY_PREFIX)) keys.add(def.subtitle);
    if (def.description?.startsWith(CONTENT_KEY_PREFIX)) keys.add(def.description);

    if ('creature' in def && def.creature.name.startsWith(CONTENT_KEY_PREFIX)) {
      keys.add(def.creature.name);
    }

    if (def.actions) {
      for (const action of Object.values(def.actions)) {
        if (action.label.startsWith(CONTENT_KEY_PREFIX)) keys.add(action.label);
      }
    }
  }

  return [...keys].sort();
}

// Flattens a nested locale JSON object into dot-path keys, one per string leaf.
export function flattenLocaleKeys(source: unknown, prefix = ''): string[] {
  if (source == null || typeof source !== 'object') return [];

  const keys: string[] = [];
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      keys.push(path);
    } else if (value && typeof value === 'object') {
      keys.push(...flattenLocaleKeys(value, path));
    }
  }
  return keys;
}

const SCAN_EXTENSIONS = new Set(['.vue', '.ts']);
const SCAN_IGNORE_DIRS = new Set(['node_modules', 'dist']);
// t('literal.key') / $t('literal.key') — single/double-quoted literal only;
// dynamic calls like t(hexobject.creature.name) are content-key lookups,
// already covered by collectContentLocaleKeys() reading CONTENT directly.
const TRANSLATION_CALL_PATTERN = /\$?\bt\(\s*['"]([A-Za-z0-9_.]+)['"]/g;

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    if (SCAN_IGNORE_DIRS.has(entry)) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
    } else if (SCAN_EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
      files.push(fullPath);
    }
  }

  return files;
}

// Statically scans apps/web/src for literal t('...')/$t('...') calls. This is
// the source of truth for which ui.json keys are actually referenced by
// code — used by both the ui.json completeness test and the orphaned-key
// test (a key with no matching call here, and no matching CONTENT entry, is
// dead weight left behind by a rename).
export function collectUiTemplateKeys(): string[] {
  const keys = new Set<string>();

  for (const file of listSourceFiles(SRC_DIR)) {
    if (file.endsWith('.test.ts') || file.endsWith('locale-keys.ts')) continue;

    const text = readFileSync(file, 'utf-8');
    for (const match of text.matchAll(TRANSLATION_CALL_PATTERN)) {
      const key = match[1];
      if (!key.startsWith(CONTENT_KEY_PREFIX)) keys.add(key);
    }
  }

  return [...keys].sort();
}
