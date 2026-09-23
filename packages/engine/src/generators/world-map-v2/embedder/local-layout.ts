import type { Axial } from '../../../utils/hex-utils';
import type { RegionTopologyGraph } from '../region-topology';
import { buildOpenAdjacency, reachableFrom } from '../graph-utils';

/**
 * Coarse node layout in local axial space, entirely rule-based (no rng) —
 * see docs/WORLD-MAP-GENERATOR-V2-PLAN.md G2. `r` (depth) is the forward
 * distance from ENTRY along OPEN edges; `q` (lane) fans a FORK's branches
 * out and pulls any convergence point (2+ incoming OPEN edges — MERGE, but
 * also LANDMARK, which every APPROACH edge converges on) back toward its
 * parent's lane, regardless of which grammar produced the graph.
 *
 * Lanes step toward DECREASING q as depth increases (`parentLane - index`
 * among a parent's OPEN successors, in edge order) rather than spreading
 * symmetrically in both directions: on a pointy-top axial grid, of the six
 * neighbour directions only `{q:0,r:+1}` and `{q:-1,r:+1}` actually move
 * "forward" (increasing r) by one hex — `{q:+1,r:+1}` is two hexes away, not
 * one. Decreasing-q keeps a fork's first two branches genuinely adjacent to
 * it; a third branch (no current grammar has one) would need a filler hex,
 * which the embedder's edge-filling step already handles generically.
 *
 * Only nodes reachable from `entryId` via `OPEN` edges get a position here.
 * A node reachable ONLY through a `BLOCKED` edge (an OBSTRUCTION) is
 * excluded — the embedder places those separately, adjacent to whichever
 * node they're attached to, since they're never on the walkable path.
 */
export function computeOpenNodeLayout(
  graph: RegionTopologyGraph,
  entryId: string,
): Map<string, Axial> {
  const adjacency = buildOpenAdjacency(graph);
  const reachable = reachableFrom(adjacency, entryId);

  const openEdges = graph.edges.filter(
    (edge) => edge.traversal === 'OPEN' && reachable.has(edge.from) && reachable.has(edge.to),
  );

  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();
  for (const edge of openEdges) {
    predecessors.set(edge.to, [...(predecessors.get(edge.to) ?? []), edge.from]);
    successors.set(edge.from, [...(successors.get(edge.from) ?? []), edge.to]);
  }

  const order = topologicalOrder([...reachable], openEdges);

  const depth = new Map<string, number>([[entryId, 0]]);
  const lane = new Map<string, number>([[entryId, 0]]);

  for (const nodeId of order) {
    if (nodeId === entryId) continue;

    const preds = predecessors.get(nodeId) ?? [];
    const parentDepths = preds.map((p) => depth.get(p) ?? 0);
    depth.set(nodeId, (parentDepths.length ? Math.max(...parentDepths) : 0) + 1);

    if (preds.length >= 2) {
      lane.set(nodeId, 0);
      continue;
    }

    const parent = preds[0];
    const parentLane = lane.get(parent) ?? 0;
    const siblings = successors.get(parent) ?? [];
    const index = Math.max(siblings.indexOf(nodeId), 0);
    lane.set(nodeId, parentLane - index);
  }

  const positions = new Map<string, Axial>();
  for (const nodeId of reachable) {
    positions.set(nodeId, { q: lane.get(nodeId) ?? 0, r: depth.get(nodeId) ?? 0 });
  }
  return positions;
}

/** Kahn's algorithm. Our grammars only ever produce DAGs on OPEN edges, so this always visits every reachable node once. */
function topologicalOrder(nodeIds: string[], edges: { from: string; to: string }[]): string[] {
  const inDegree = new Map(nodeIds.map((id) => [id, 0]));
  const adjacency = new Map<string, string[]>(nodeIds.map((id) => [id, []]));

  for (const edge of edges) {
    adjacency.get(edge.from)?.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  const queue = nodeIds.filter((id) => (inDegree.get(id) ?? 0) === 0);
  const order: string[] = [];

  while (queue.length) {
    const id = queue.shift() as string;
    order.push(id);
    for (const next of adjacency.get(id) ?? []) {
      const remaining = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  return order;
}
