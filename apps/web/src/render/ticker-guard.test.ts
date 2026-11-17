import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const RENDER_DIR = __dirname;
const HELPER = 'ticker-subscription.ts';
const DIRECT_TICKER_ADD = /\b(?:ticker|Ticker\.shared)\s*\??\.\s*add(?:Once)?\s*\(/i;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.(ts|vue)$/.test(entry.name) || /\.test\.ts$/.test(entry.name)) return [];
    return [path];
  });
}

function directTickerAdds(files: Array<{ path: string; text: string }>): string[] {
  return files.flatMap(({ path, text }) =>
    text
      .split('\n')
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => DIRECT_TICKER_ADD.test(line))
      .map(({ index }) => `${path}:${index + 1}`),
  );
}

describe('ticker subscriptions in render', () => {
  it('REQ-3: only the shared helper adds listeners to a ticker directly', () => {
    const files = sourceFiles(RENDER_DIR)
      .map((path) => ({ path: relative(RENDER_DIR, path), text: readFileSync(path, 'utf8') }))
      .filter(({ path }) => path !== HELPER);

    expect(directTickerAdds(files)).toEqual([]);
  });

  it('catches every form of a direct ticker add', () => {
    const lines = [
      'Ticker.shared.add(tick);',
      'deps.ticker.add(onTick);',
      'app.ticker.addOnce(callback, undefined, 1);',
      'this.ticker?.add(spin);',
    ];

    expect(directTickerAdds([{ path: 'x.ts', text: lines.join('\n') }])).toHaveLength(4);
  });
});
