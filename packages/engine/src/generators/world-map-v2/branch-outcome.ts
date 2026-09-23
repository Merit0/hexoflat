import type { RegionTopologyGraph } from './region-topology';
import { buildOpenAdjacency, reachableFrom } from './graph-utils';

/**
 * The plan's §2.5 BranchOutcomeVector, computed purely on the graph — no
 * hexes exist yet in G1. `sightGain` stands in for "how much new space this
 * branch alone reveals": since there is no embedder yet to count hexes, it
 * is approximated as the node count exclusive to this branch (not reachable
 * from any sibling branch of the same fork).
 */
export interface BranchOutcome {
  pathHexes: number;
  poiTouched: number;
  exitsReached: string[];
  sightGain: number;
}

/**
 * One BranchOutcome per OPEN outgoing edge of `forkNodeId`, keyed by that
 * edge's id. A node counts toward a branch only if it is NOT also reachable
 * from a sibling branch — that is what makes a MERGE node (and anything
 * beyond it) excluded from every branch's own contribution, without needing
 * to know where any particular grammar puts its merge point.
 */
export function computeForkBranchOutcomes(
  graph: RegionTopologyGraph,
  forkNodeId: string,
): Map<string, BranchOutcome> {
  const adjacency = buildOpenAdjacency(graph);
  const branches = adjacency.get(forkNodeId) ?? [];
  const reachablePerBranch = branches.map((branch) => reachableFrom(adjacency, branch.to));

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const outcomes = new Map<string, BranchOutcome>();

  branches.forEach((branch, index) => {
    const own = reachablePerBranch[index];
    const others = reachablePerBranch.filter((_, otherIndex) => otherIndex !== index);
    const exclusive = new Set(
      [...own].filter((nodeId) => !others.some((otherSet) => otherSet.has(nodeId))),
    );

    let pathHexes = 0;
    let poiTouched = 0;
    const exitsReached: string[] = [];

    for (const nodeId of exclusive) {
      const node = nodesById.get(nodeId);
      if (!node) continue;
      if (node.role === 'POI') poiTouched += 1;
      if (node.role === 'PORTAL') exitsReached.push(nodeId);
    }

    for (const edge of graph.edges) {
      if (edge.traversal !== 'OPEN') continue;
      const isForkEdge = edge.from === forkNodeId && edge.to === branch.to;
      const isInsideBranch = exclusive.has(edge.from) && exclusive.has(edge.to);
      if (isForkEdge || isInsideBranch) pathHexes += edge.weight;
    }

    // A portal beyond a shared merge point is still reached by this branch —
    // it just isn't what tells this branch apart from its sibling, so it's
    // read from the full reachable set rather than only the exclusive part.
    for (const nodeId of own) {
      if (nodesById.get(nodeId)?.role === 'PORTAL' && !exitsReached.includes(nodeId)) {
        exitsReached.push(nodeId);
      }
    }

    outcomes.set(branch.edgeId, {
      pathHexes,
      poiTouched,
      exitsReached: exitsReached.sort(),
      sightGain: exclusive.size,
    });
  });

  return outcomes;
}

/** Branches "differ" (§2.5) if any single BranchOutcome dimension differs. */
export function branchOutcomesDiffer(a: BranchOutcome, b: BranchOutcome): boolean {
  if (a.pathHexes !== b.pathHexes) return true;
  if (a.poiTouched !== b.poiTouched) return true;
  if (a.sightGain !== b.sightGain) return true;
  if (a.exitsReached.length !== b.exitsReached.length) return true;
  return a.exitsReached.some((exit, index) => exit !== b.exitsReached[index]);
}
