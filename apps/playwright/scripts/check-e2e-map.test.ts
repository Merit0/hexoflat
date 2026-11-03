import { describe, expect, it } from 'vitest';
import { impactMapSchema } from '../impact-map';
import { checkE2EMap, type ListedTest } from './check-e2e-map';

const map = impactMapSchema.parse({
  smokeTag: '@smoke',
  smokeOn: ['apps/web/**'],
  global: ['packages/engine/**'],
  boundaries: [],
  ignore: ['**/*.md'],
  groups: {
    board: { roots: ['apps/web/src/board/**'], specs: 'apps/playwright/e2e/board/**' },
    hero: { roots: ['apps/web/src/hero/**'], specs: 'apps/playwright/e2e/hero/**' },
  },
});

const test = (file: string, tags: string[], title = 'a test'): ListedTest => ({
  file,
  title,
  tags,
});
const good = [test('e2e/board/a.spec.ts', ['@board']), test('e2e/hero/b.spec.ts', ['@hero'])];

describe('checkE2EMap', () => {
  it('accepts tagged specs in their own group folders', () => {
    expect(checkE2EMap(good, map, {}).problems).toEqual([]);
  });

  it('accepts @smoke and a known extra group tag next to the primary tag', () => {
    const tests = [
      test('e2e/board/a.spec.ts', ['@board', '@smoke', '@hero']),
      good[1] as ListedTest,
    ];
    expect(checkE2EMap(tests, map, {}).problems).toEqual([]);
  });

  it('rejects a test without the tag of its folder', () => {
    const problems = checkE2EMap(
      [...good, test('e2e/board/c.spec.ts', ['@hero'], 'wrong')],
      map,
      {},
    ).problems;
    expect(problems).toEqual(['e2e/board/c.spec.ts: "wrong" is missing its primary tag @board']);
  });

  it('rejects a spec outside every group folder', () => {
    const problems = checkE2EMap(
      [...good, test('e2e/world/d.spec.ts', ['@board'])],
      map,
      {},
    ).problems;
    expect(problems[0]).toMatch(/lives in no group folder/);
  });

  it('rejects an unknown tag', () => {
    const problems = checkE2EMap(
      [test('e2e/board/a.spec.ts', ['@board', '@nope']), good[1] as ListedTest],
      map,
      {},
    ).problems;
    expect(problems[0]).toMatch(/unknown tag @nope/);
  });

  it('rejects a group without specs', () => {
    expect(checkE2EMap([good[0] as ListedTest], map, {}).problems).toEqual([
      'group "hero" has no spec',
    ]);
  });

  it('lists web files no group reaches as unmapped, without failing', () => {
    const graph = {
      'apps/web/src/board/view.ts': ['apps/web/src/shared.ts'],
      'apps/web/src/shared.ts': [],
      'apps/web/src/lonely.ts': [],
    };
    const result = checkE2EMap(good, map, graph);
    expect(result.problems).toEqual([]);
    expect(result.unmapped).toEqual(['apps/web/src/lonely.ts']);
  });
});
