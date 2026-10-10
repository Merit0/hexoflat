import type { StaticBoardDrawing } from '../content/boards/schemas';

function matchRequired(source: string, pattern: RegExp, label: string): string {
  const match = source.match(pattern);
  if (!match) throw new Error(`could not find ${label} in serialized static board drawing`);
  return match[1];
}

function parseScalar(text: string): unknown {
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text === 'null') return null;
  if (text.startsWith("'")) return text.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  return Number(text);
}

function parseFlatObjectLiteral(text: string): Record<string, unknown> {
  const body = text.trim().replace(/^\{/, '').replace(/\}$/, '');
  const result: Record<string, unknown> = {};
  const pairPattern = /(\w+):\s*('(?:[^'\\]|\\.)*'|-?\d+(?:\.\d+)?|true|false|null)/g;
  let match: RegExpExecArray | null;
  while ((match = pairPattern.exec(body))) {
    result[match[1]] = parseScalar(match[2]);
  }
  return result;
}

export function deserializeStaticBoardDrawing(source: string): StaticBoardDrawing {
  const id = matchRequired(source, /id:\s*'([^']*)'/, 'id');
  const background = matchRequired(source, /background:\s*'([^']*)'/, 'background');

  const legendBlock = source.match(/legend:\s*\{([\s\S]*?)\n {2}\},/);
  const legend: StaticBoardDrawing['legend'] = {};
  if (legendBlock) {
    const entryPattern =
      /(\w+):\s*\{\s*hexobjectKey:\s*'([^']*)'\s*(?:,\s*overrides:\s*(\{[^{}]*\}))?\s*\},/g;
    let match: RegExpExecArray | null;
    while ((match = entryPattern.exec(legendBlock[1]))) {
      const [, letter, hexobjectKey, overridesText] = match;
      legend[letter] = {
        hexobjectKey: hexobjectKey as StaticBoardDrawing['legend'][string]['hexobjectKey'],
        ...(overridesText ? { overrides: parseFlatObjectLiteral(overridesText) } : {}),
      };
    }
  }

  const rowsBlock = source.match(/rows:\s*\[([\s\S]*?)\n {2}\],/);
  const rows: string[] = [];
  if (rowsBlock) {
    const rowPattern = /'((?:[^'\\]|\\.)*)',\s*\/\/\s*r\d+/g;
    let match: RegExpExecArray | null;
    while ((match = rowPattern.exec(rowsBlock[1]))) {
      rows.push(match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
    }
  }

  return { id, background, legend, rows };
}
