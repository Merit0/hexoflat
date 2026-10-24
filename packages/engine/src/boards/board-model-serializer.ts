import type { BoardRecipeInput } from '../content/boards/recipe-schema';

const PRINT_WIDTH = 100;
const INDENT = '  ';
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f\u2028\u2029]/g;
const SHORT_ESCAPES: Record<string, string> = { '\n': '\\n', '\r': '\\r', '\t': '\\t' };

function escapeControl(character: string): string {
  return SHORT_ESCAPES[character] ?? `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`;
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function quote(text: string): string {
  const useDouble = text.includes("'") && !text.includes('"');
  const quoteChar = useDouble ? '"' : "'";
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replaceAll(quoteChar, `\\${quoteChar}`)
    .replace(CONTROL_CHARACTERS, escapeControl);
  return `${quoteChar}${escaped}${quoteChar}`;
}

function keyText(key: string): string {
  return IDENTIFIER.test(key) ? key : quote(key);
}

function isPlainObject(value: Json): value is { [key: string]: Json } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function inline(value: Json): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.map(inline).join(', ')}]`;
  const entries = Object.entries(value);
  if (entries.length === 0) return '{}';
  return `{ ${entries.map(([key, entry]) => `${keyText(key)}: ${inline(entry)}`).join(', ')} }`;
}

function mustBreak(value: Json): boolean {
  if (Array.isArray(value)) {
    if (value.length < 2) return false;
    const allObjects = value.every((item) => isPlainObject(item) && Object.keys(item).length > 1);
    const allArrays = value.every((item) => Array.isArray(item) && item.length > 1);
    return allObjects || allArrays;
  }
  return false;
}

function format(value: Json, level: number, used: number): string {
  const flat = inline(value);
  const isContainer = typeof value === 'object' && value !== null;
  const empty = isContainer && Object.keys(value).length === 0;
  if (!isContainer || empty || (used + flat.length <= PRINT_WIDTH && !mustBreak(value))) {
    return flat;
  }

  const inner = INDENT.repeat(level + 1);
  const close = INDENT.repeat(level);
  if (Array.isArray(value)) {
    const items = value.map((item) => `${inner}${format(item, level + 1, inner.length + 1)},`);
    return `[\n${items.join('\n')}\n${close}]`;
  }
  const entries = Object.entries(value).map(([key, entry]) => {
    const prefix = `${inner}${keyText(key)}: `;
    return `${prefix}${format(entry, level + 1, prefix.length + 1)},`;
  });
  return `{\n${entries.join('\n')}\n${close}}`;
}

export function boardModelConstName(id: string): string {
  return `${id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_MODEL`;
}

export function serializeBoardModel(recipe: BoardRecipeInput): string {
  const prefix = `export const ${boardModelConstName(recipe.id)} = `;
  const suffix = ' satisfies BoardRecipeInput;';
  const body = format(recipe as Json, 0, prefix.length);
  return `import type { BoardRecipeInput } from '../recipe-schema';\n\n${prefix}${body}${suffix}\n`;
}
