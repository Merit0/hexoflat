import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { coordinateKey, getOddQNeighbors } from '../utils/hex-utils';
import type { SectionGraph } from './world-map-assembler';

export interface NeighbourStats {
  mean: number;
  thinShare: number;
  articulationShare: number;
}

function keyToCoord(k: string): IHexCoordinates {
  const [columnIndex, rowIndex] = k.split(':').map(Number);
  return { columnIndex, rowIndex };
}

function passableAdjacency(passable: Set<string>): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const k of passable) {
    adj.set(
      k,
      getOddQNeighbors(keyToCoord(k))
        .map(coordinateKey)
        .filter((n) => passable.has(n)),
    );
  }
  return adj;
}

function articulationShare(adj: Map<string, string[]>): number {
  const nodes = [...adj.keys()];
  if (nodes.length < 3) return 0;

  const disc = new Map<string, number>();
  const low = new Map<string, number>();
  const art = new Set<string>();
  let timer = 0;

  const visit = (u: string, parent: string | null): void => {
    disc.set(u, timer);
    low.set(u, timer);
    timer += 1;
    let children = 0;

    for (const v of adj.get(u) ?? []) {
      if (!disc.has(v)) {
        children += 1;
        visit(v, u);
        low.set(u, Math.min(low.get(u) ?? 0, low.get(v) ?? 0));
        if (parent !== null && (low.get(v) ?? 0) >= (disc.get(u) ?? 0)) art.add(u);
      } else if (v !== parent) {
        low.set(u, Math.min(low.get(u) ?? 0, disc.get(v) ?? 0));
      }
    }

    if (parent === null && children > 1) art.add(u);
  };

  for (const k of nodes) if (!disc.has(k)) visit(k, null);
  return art.size / nodes.length;
}

export function neighbourStats(passable: Set<string>): NeighbourStats {
  if (passable.size === 0) return { mean: 0, thinShare: 1, articulationShare: 0 };

  const adj = passableAdjacency(passable);
  let total = 0;
  let thin = 0;
  for (const nbrs of adj.values()) {
    total += nbrs.length;
    if (nbrs.length <= 2) thin += 1;
  }

  return {
    mean: total / passable.size,
    thinShare: thin / passable.size,
    articulationShare: articulationShare(adj),
  };
}

export interface AreaGraph {
  nodes: number[];
  edges: [number, number][];
}

export function buildAreaGraph(graph: SectionGraph): AreaGraph {
  const classOf = new Map(graph.nodes.map((n) => [n.id, n.class]));
  const treeAdj = new Map<number, number[]>();
  for (const n of graph.nodes) treeAdj.set(n.id, []);
  for (const [a, b] of graph.edges) {
    treeAdj.get(a)?.push(b);
    treeAdj.get(b)?.push(a);
  }

  const nodes = graph.nodes.filter((n) => n.class === 'AREA').map((n) => n.id);
  const edges: [number, number][] = [];

  for (const [a, b] of [...graph.edges, ...graph.bridgeEdges]) {
    if (classOf.get(a) === 'AREA' && classOf.get(b) === 'AREA' && a !== b) edges.push([a, b]);
  }
  for (const n of graph.nodes) {
    if (n.class !== 'LINK') continue;
    const areaNbrs = (treeAdj.get(n.id) ?? []).filter((x) => classOf.get(x) === 'AREA');
    for (let i = 0; i < areaNbrs.length; i += 1) {
      for (let j = i + 1; j < areaNbrs.length; j += 1) {
        if (areaNbrs[i] !== areaNbrs[j]) edges.push([areaNbrs[i], areaNbrs[j]]);
      }
    }
  }

  return { nodes, edges };
}

function adjacencyOf(area: AreaGraph, skip?: number): Map<number, number[]> {
  const adj = new Map<number, number[]>();
  for (const n of area.nodes) adj.set(n, []);
  area.edges.forEach(([a, b], index) => {
    if (index === skip) return;
    adj.get(a)?.push(b);
    adj.get(b)?.push(a);
  });
  return adj;
}

function componentCount(adj: Map<number, number[]>): number {
  const seen = new Set<number>();
  let count = 0;
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    count += 1;
    const queue = [start];
    seen.add(start);
    while (queue.length) {
      const cur = queue.shift() as number;
      for (const n of adj.get(cur) ?? []) {
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
  }
  return count;
}

export function areaGraphCycles(area: AreaGraph): number {
  if (area.nodes.length === 0) return 0;
  return area.edges.length - area.nodes.length + componentCount(adjacencyOf(area));
}

function reaches(adj: Map<number, number[]>, from: number, to: number): boolean {
  if (from === to) return true;
  const seen = new Set<number>([from]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift() as number;
    for (const n of adj.get(cur) ?? []) {
      if (n === to) return true;
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return false;
}

export function areasTwoEdgeConnected(area: AreaGraph, a: number, b: number): boolean {
  if (!area.nodes.includes(a) || !area.nodes.includes(b)) return false;
  if (!reaches(adjacencyOf(area), a, b)) return false;
  for (let i = 0; i < area.edges.length; i += 1) {
    if (!reaches(adjacencyOf(area, i), a, b)) return false;
  }
  return true;
}
