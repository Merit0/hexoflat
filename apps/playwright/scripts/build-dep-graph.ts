import path from 'node:path';
import { cruise, type ICruiseResult } from 'dependency-cruiser';
import type { DepGraph } from './select-e2e';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');

interface CruiseTarget {
  dir: string;
  tsConfig: string;
}

const TARGETS: CruiseTarget[] = [
  { dir: 'apps/web/src', tsConfig: 'apps/web/tsconfig.json' },
  { dir: 'apps/playwright/src', tsConfig: 'apps/playwright/tsconfig.json' },
  { dir: 'apps/playwright/e2e', tsConfig: 'apps/playwright/tsconfig.json' },
];

function toRepoPath(resolved: string): string {
  return resolved.split(path.sep).join('/');
}

async function cruiseTarget(target: CruiseTarget): Promise<ICruiseResult> {
  const result = await cruise(
    [target.dir],
    {
      baseDir: REPO_ROOT,
      tsConfig: { fileName: path.join(REPO_ROOT, target.tsConfig) },
      doNotFollow: { path: 'node_modules' },
      exclude: { path: String.raw`\.test\.tsx?$` },
      combinedDependencies: false,
      enhancedResolveOptions: {
        exportsFields: ['exports'],
        conditionNames: ['import', 'require', 'node', 'default'],
      },
    },
    { extensions: ['.ts', '.tsx', '.js', '.vue', '.d.ts'] },
  );
  return result.output as ICruiseResult;
}

export async function buildDepGraph(): Promise<DepGraph> {
  const graph: DepGraph = {};
  for (const target of TARGETS) {
    const output = await cruiseTarget(target);
    for (const module of output.modules) {
      const from = toRepoPath(module.source);
      if (from.includes('node_modules')) continue;
      const edges = (graph[from] ??= []);
      for (const dependency of module.dependencies) {
        if (dependency.couldNotResolve || dependency.coreModule) continue;
        const to = toRepoPath(dependency.resolved);
        if (to.includes('node_modules')) continue;
        edges.push(to);
      }
    }
  }
  return graph;
}
