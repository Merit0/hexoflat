import { describe, expect, it } from 'vitest';
import { impactMap as realMap, impactMapSchema } from '../impact-map';
import { selectE2E, type DepGraph } from './select-e2e';

const map = impactMapSchema.parse({
  smokeTag: '@smoke',
  smokeOn: ['apps/web/**'],
  global: ['packages/engine/**', 'apps/playwright/src/framework/**', 'pnpm-lock.yaml'],
  boundaries: ['apps/web/src/stores/*-store.ts'],
  ignore: ['**/*.md', 'docs/**', '**/*.test.ts'],
  groups: {
    board: {
      roots: ['apps/web/src/render/**', 'apps/web/src/board-scene.vue'],
      specs: 'apps/playwright/e2e/board/**',
    },
    camp: {
      roots: ['apps/web/src/camp/**'],
      specs: 'apps/playwright/e2e/camp/**',
    },
    hero: {
      roots: ['apps/web/src/hero/**'],
      specs: 'apps/playwright/e2e/hero/**',
    },
  },
});

const graph: DepGraph = {
  'apps/web/src/render/fog-layer.ts': ['apps/web/src/render/fog-look.ts'],
  'apps/web/src/render/fog-look.ts': [],
  'apps/web/src/board-scene.vue': [
    'apps/web/src/render/fog-layer.ts',
    'apps/web/src/only-board.ts',
  ],
  'apps/web/src/only-board.ts': [],
  'apps/web/src/camp/portal.vue': [
    'apps/web/src/shared/will-number.vue',
    'apps/web/src/stores/hub-store.ts',
  ],
  'apps/web/src/hero/panel.vue': [
    'apps/web/src/shared/will-number.vue',
    'apps/web/src/hero/hearts.ts',
  ],
  'apps/web/src/hero/hearts.ts': [],
  'apps/web/src/shared/will-number.vue': ['apps/web/src/shared/format.ts'],
  'apps/web/src/shared/format.ts': [],
  'apps/web/src/orphan.ts': [],
  'apps/web/src/stores/hub-store.ts': ['apps/web/src/hero/panel.vue', 'apps/web/src/store-only.ts'],
  'apps/web/src/store-only.ts': [],
  'apps/playwright/e2e/board/move.spec.ts': ['apps/playwright/src/features/move.feature.ts'],
  'apps/playwright/e2e/hero/panel.spec.ts': [
    'apps/playwright/src/features/panel.feature.ts',
    'apps/playwright/src/features/shared.feature.ts',
  ],
  'apps/playwright/e2e/camp/portal.spec.ts': ['apps/playwright/src/features/shared.feature.ts'],
  'apps/playwright/src/features/move.feature.ts': [
    'apps/playwright/src/components/hex.component.ts',
  ],
  'apps/playwright/src/features/panel.feature.ts': [
    'apps/playwright/src/components/panel.component.ts',
  ],
  'apps/playwright/src/features/shared.feature.ts': [],
  'apps/playwright/src/components/hex.component.ts': [],
  'apps/playwright/src/components/panel.component.ts': [],
};

const select = (...files: string[]) => selectE2E(files, map, graph);

describe('selectE2E', () => {
  it('skips e2e when only markdown, docs and unit tests changed', () => {
    const result = select('README.md', 'docs/e2e/plan.md', 'apps/web/src/render/fog-look.test.ts');
    expect(result.mode).toBe('none');
    expect(result.grep).toBeNull();
  });

  it('runs everything for any file in packages/engine', () => {
    const result = select('packages/engine/src/battle/strike.ts');
    expect(result.mode).toBe('all');
    expect(result.reasons[0]?.why).toMatch(/^global/);
  });

  it('runs everything for the lockfile and the test framework', () => {
    expect(select('pnpm-lock.yaml').mode).toBe('all');
    expect(select('apps/playwright/src/framework/base-feature.ts').mode).toBe('all');
  });

  it('maps a file in a board root to board plus smoke', () => {
    const result = select('apps/web/src/render/fog-layer.ts');
    expect(result.mode).toBe('groups');
    expect(result.groups).toEqual(['board', 'smoke']);
    expect(result.grep).toBe('@board|@smoke');
  });

  it('maps a file only imported by a board root to board', () => {
    const result = select('apps/web/src/only-board.ts');
    expect(result.groups).toEqual(['board', 'smoke']);
    expect(result.reasons[0]?.why).toContain('board-scene.vue');
  });

  it('lifts exactly the groups that import a shared component', () => {
    const result = select('apps/web/src/shared/will-number.vue');
    expect(result.groups).toEqual(['camp', 'hero', 'smoke']);
  });

  it('follows imports transitively, not just one hop', () => {
    const result = select('apps/web/src/shared/format.ts');
    expect(result.groups).toEqual(['camp', 'hero', 'smoke']);
    expect(result.reasons[0]?.why).toContain('will-number.vue → format.ts');
  });

  it('runs everything for a new file no group owns, saying why', () => {
    const result = select('apps/web/src/orphan.ts');
    expect(result.mode).toBe('all');
    expect(result.reasons[0]?.why).toMatch(/^unmapped/);
  });

  it('runs everything for a file outside web and playwright', () => {
    expect(select('apps/api/src/game/game.service.ts').mode).toBe('all');
  });

  it('treats a file missing from the graph under a root as owned by that root', () => {
    const result = select('apps/web/src/hero/deleted-in-this-push.ts');
    expect(result.groups).toEqual(['hero', 'smoke']);
  });

  it('runs everything for a deleted file that no root glob covers', () => {
    expect(select('apps/web/src/shared/deleted.ts').mode).toBe('all');
  });

  it('runs the one group whose spec uses a changed test component', () => {
    const result = select('apps/playwright/src/components/hex.component.ts');
    expect(result.mode).toBe('groups');
    expect(result.groups).toEqual(['board']);
  });

  it('runs every group whose spec uses a shared feature, without smoke', () => {
    const result = select('apps/playwright/src/features/shared.feature.ts');
    expect(result.groups).toEqual(['camp', 'hero']);
  });

  it('runs the group of a changed spec file', () => {
    const result = select('apps/playwright/e2e/hero/panel.spec.ts');
    expect(result.groups).toEqual(['hero']);
  });

  it('does not ignore an e2e spec just because it ends in .spec.ts', () => {
    expect(select('apps/playwright/e2e/board/move.spec.ts').mode).toBe('groups');
  });

  it('merges groups from several files and keeps one reason per file', () => {
    const result = select('apps/web/src/render/fog-look.ts', 'apps/web/src/hero/hearts.ts');
    expect(result.groups).toEqual(['board', 'hero', 'smoke']);
    expect(result.reasons).toHaveLength(2);
  });

  it('lets one unmapped file escalate a mixed push to the whole suite', () => {
    const result = select('apps/web/src/hero/hearts.ts', 'apps/web/src/orphan.ts');
    expect(result.mode).toBe('all');
    expect(result.reasons).toHaveLength(2);
  });

  it('normalises ./ prefixes', () => {
    expect(select('./apps/web/src/hero/hearts.ts').groups).toEqual(['hero', 'smoke']);
  });
});

describe('boundaries', () => {
  it('does not walk through a store that a group merely imports', () => {
    expect(select('apps/web/src/store-only.ts').mode).toBe('all');
  });

  it('does not let a store pull its consumers in: a file under a hero file stays hero', () => {
    const result = select('apps/web/src/hero/hearts.ts');
    expect(result.groups).toEqual(['hero', 'smoke']);
  });
});

describe('the real impact map', () => {
  it('sends every spec of its own group, and only that group, with no smoke', () => {
    const result = selectE2E(['apps/playwright/e2e/combat/battle-flow.spec.ts'], realMap, {
      'apps/playwright/e2e/combat/battle-flow.spec.ts': [],
    });
    expect(result.groups).toEqual(['combat']);
  });

  it('keeps the engine global', () => {
    expect(selectE2E(['packages/engine/src/index.ts'], realMap, {}).mode).toBe('all');
  });
});
