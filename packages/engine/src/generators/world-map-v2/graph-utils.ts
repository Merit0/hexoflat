import type { RegionTopologyGraph } from './region-topology';

export interface AdjacencyEntry {
  edgeId: string;
  to: string;
}

/**
 * Adjacency over OPEN edges only. A `BLOCKED` edge (e.g. an obstruction's
 * marker edge in BASIN) is never a route — nodes reachable only through one
 * don't count as reachable at all.
 */
export function buildOpenAdjacency(graph: RegionTopologyGraph): Map<string, AdjacencyEntry[]> {
  const adjacency = new Map<string, AdjacencyEntry[]>();
  for (const node of graph.nodes) adjacency.set(node.id, []);
  for (const edge of graph.edges) {
    if (edge.traversal !== 'OPEN') continue;
    adjacency.get(edge.from)?.push({ edgeId: edge.id, to: edge.to });
  }
  return adjacency;
}

export function reachableFrom(
  adjacency: Map<string, AdjacencyEntry[]>,
  startNodeId: string,
): Set<string> {
  const seen = new Set<string>([startNodeId]);
  const queue: string[] = [startNodeId];

  while (queue.length) {
    const current = queue.shift() as string;
    for (const { to } of adjacency.get(current) ?? []) {
      if (!seen.has(to)) {
        seen.add(to);
        queue.push(to);
      }
    }
  }

  return seen;
}
