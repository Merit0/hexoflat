import picomatch from 'picomatch';
import type { ImpactMap } from '../impact-map';

export type DepGraph = Record<string, string[]>;

export type SelectionMode = 'all' | 'groups' | 'none';

export interface SelectionReason {
  file: string;
  groups: string[];
  why: string;
}

export interface Selection {
  mode: SelectionMode;
  groups: string[];
  reasons: SelectionReason[];
  grep: string | null;
}

interface Reach {
  roots: Set<string>;
  parent: Map<string, string>;
}

const WEB_SOURCES = 'apps/web/src/**';
const PLAYWRIGHT_SOURCES = 'apps/playwright/**';

const matcher = (patterns: readonly string[]): ((file: string) => boolean) => {
  const isMatch = picomatch([...patterns], { dot: true });
  return (file) => isMatch(file);
};

function normalise(file: string): string {
  return file.replace(/^\.\//, '');
}

function reachFrom(
  rootFiles: string[],
  graph: DepGraph,
  isBoundary: (file: string) => boolean = () => false,
): Reach {
  const parent = new Map<string, string>();
  const roots = new Set(rootFiles);
  const seen = new Set(rootFiles);
  const queue = [...rootFiles];
  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i] as string;
    if (isBoundary(current) && !roots.has(current)) continue;
    for (const next of graph[current] ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      parent.set(next, current);
      queue.push(next);
    }
  }
  return { roots, parent };
}

function chainTo(file: string, reach: Reach): string[] {
  const chain = [file];
  let current = file;
  while (!reach.roots.has(current)) {
    const up = reach.parent.get(current);
    if (up === undefined) break;
    chain.unshift(up);
    current = up;
  }
  return chain;
}

function describeChain(chain: string[]): string {
  const [root, ...rest] = chain;
  if (rest.length === 0) return `is a root file`;
  const names = rest.map((step) => step.split('/').pop());
  return `imported by root ${root} via ${names.join(' → ')}`;
}

function isReached(file: string, reach: Reach): boolean {
  return reach.roots.has(file) || reach.parent.has(file);
}

class Resolver {
  private readonly rootReach = new Map<string, Reach>();
  private readonly specReach = new Map<string, Reach>();
  private readonly rootMatchers = new Map<string, (file: string) => boolean>();
  private readonly specMatchers = new Map<string, (file: string) => boolean>();

  constructor(
    private readonly map: ImpactMap,
    private readonly graph: DepGraph,
  ) {
    const nodes = Object.keys(graph);
    const isBoundary = matcher(map.boundaries);
    for (const [name, group] of Object.entries(map.groups)) {
      const isRoot = matcher(group.roots);
      const isSpec = matcher([group.specs]);
      this.rootMatchers.set(name, isRoot);
      this.specMatchers.set(name, isSpec);
      this.rootReach.set(name, reachFrom(nodes.filter(isRoot), graph, isBoundary));
      this.specReach.set(name, reachFrom(nodes.filter(isSpec), graph));
    }
  }

  webOwners(file: string): Map<string, string> {
    const owners = new Map<string, string>();
    for (const name of Object.keys(this.map.groups)) {
      const reach = this.rootReach.get(name) as Reach;
      if ((this.rootMatchers.get(name) as (f: string) => boolean)(file)) {
        owners.set(name, 'matches a root of the group');
      } else if (isReached(file, reach)) {
        owners.set(name, describeChain(chainTo(file, reach)));
      }
    }
    return owners;
  }

  playwrightOwners(file: string): Map<string, string> {
    const owners = new Map<string, string>();
    for (const name of Object.keys(this.map.groups)) {
      const reach = this.specReach.get(name) as Reach;
      if ((this.specMatchers.get(name) as (f: string) => boolean)(file)) {
        owners.set(name, 'is a spec of the group');
      } else if (isReached(file, reach)) {
        owners.set(name, describeChain(chainTo(file, reach)).replace('root', 'spec'));
      }
    }
    return owners;
  }
}

function ownersOf(file: string, resolver: Resolver): Map<string, string> | null {
  if (picomatch(WEB_SOURCES, { dot: true })(file)) return resolver.webOwners(file);
  if (picomatch(PLAYWRIGHT_SOURCES, { dot: true })(file)) return resolver.playwrightOwners(file);
  return null;
}

export function selectE2E(
  changedFiles: readonly string[],
  map: ImpactMap,
  graph: DepGraph,
): Selection {
  const isIgnored = matcher(map.ignore);
  const isGlobal = matcher(map.global);
  const needsSmoke = matcher(map.smokeOn);
  const resolver = new Resolver(map, graph);

  const reasons: SelectionReason[] = [];
  const groups = new Set<string>();
  let runAll = false;

  for (const raw of changedFiles) {
    const file = normalise(raw);
    if (isIgnored(file)) continue;
    if (isGlobal(file)) {
      runAll = true;
      reasons.push({ file, groups: [], why: 'global: shared infrastructure, run everything' });
      continue;
    }
    const owners = ownersOf(file, resolver);
    if (owners === null || owners.size === 0) {
      runAll = true;
      reasons.push({ file, groups: [], why: 'unmapped: no group owns this file, run everything' });
      continue;
    }
    const fileGroups = [...owners.keys()];
    if (needsSmoke(file)) fileGroups.push('smoke');
    fileGroups.forEach((name) => groups.add(name));
    reasons.push({
      file,
      groups: fileGroups.sort(),
      why: [...owners].map(([name, why]) => `${name} ← ${why}`).join('; '),
    });
  }

  if (runAll) return { mode: 'all', groups: [], reasons, grep: null };
  if (groups.size === 0) return { mode: 'none', groups: [], reasons, grep: null };

  const sorted = [...groups].sort();
  const tag = (name: string) => (name === 'smoke' ? map.smokeTag : `@${name}`);
  return { mode: 'groups', groups: sorted, reasons, grep: sorted.map(tag).join('|') };
}
