import type { ImpactMap } from '../impact-map';
import { selectE2E, type DepGraph } from './select-e2e';

export interface ListedTest {
  file: string;
  title: string;
  tags: string[];
}

export interface MapCheck {
  problems: string[];
  unmapped: string[];
}

const SPEC_FOLDER = /^e2e\/([^/]+)\//;

function primaryGroup(file: string): string | null {
  return SPEC_FOLDER.exec(file)?.[1] ?? null;
}

export function checkE2EMap(
  tests: readonly ListedTest[],
  map: ImpactMap,
  graph: DepGraph,
): MapCheck {
  const problems: string[] = [];
  const groupNames = new Set(Object.keys(map.groups));
  const filesByGroup = new Map<string, Set<string>>();

  for (const test of tests) {
    const group = primaryGroup(test.file);
    if (group === null || !groupNames.has(group)) {
      problems.push(`${test.file}: lives in no group folder of the impact map`);
      continue;
    }
    (filesByGroup.get(group) ?? filesByGroup.set(group, new Set()).get(group))?.add(test.file);
    if (!test.tags.includes(`@${group}`)) {
      problems.push(`${test.file}: "${test.title}" is missing its primary tag @${group}`);
    }
    for (const tag of test.tags) {
      const extra = tag.slice(1);
      if (tag === `@${group}` || tag === map.smokeTag) continue;
      if (!groupNames.has(extra)) {
        problems.push(`${test.file}: "${test.title}" has unknown tag ${tag}`);
      }
    }
  }

  for (const group of groupNames) {
    if (!filesByGroup.has(group)) problems.push(`group "${group}" has no spec`);
  }

  const webFiles = Object.keys(graph).filter((file) => file.startsWith('apps/web/src/'));
  const unmapped = selectE2E(webFiles, map, graph)
    .reasons.filter((reason) => reason.why.startsWith('unmapped'))
    .map((reason) => reason.file);

  return { problems, unmapped };
}
