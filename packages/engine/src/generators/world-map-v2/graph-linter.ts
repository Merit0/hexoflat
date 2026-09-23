import type { RegionGraphNodeRole, RegionTopologyGraph } from './region-topology';
import { buildOpenAdjacency, reachableFrom } from './graph-utils';
import { branchOutcomesDiffer, computeForkBranchOutcomes } from './branch-outcome';
import type { GrammarId } from './grammars';

export type GraphLintResult = { ok: true } | { ok: false; reason: string };

/**
 * A board where two of five nodes are already narrow links reads as a
 * trail, not a composition of areas (D15) — this is the fixed ceiling on
 * how much of a graph's node count `PATH_SEGMENT` may occupy. Our own BASIN
 * grammar's NECK sits at one or two `PATH_SEGMENT` nodes out of six or
 * seven total (well under this), so the ceiling only ever fires on a graph
 * that is genuinely dominated by narrow links.
 */
const PATH_SEGMENT_SHARE_CEILING = 0.4;

const GRAMMAR_REQUIRED_ROLES: Record<GrammarId, RegionGraphNodeRole[]> = {
  ROUTE_FORK: ['ENTRY', 'FORK', 'MERGE', 'POI', 'PORTAL'],
  BASIN: ['ENTRY', 'FORK', 'OBSTRUCTION', 'PORTAL'],
  LANDMARK_RING: ['ENTRY', 'FORK', 'LANDMARK', 'PORTAL'],
};

/**
 * Rejects a candidate graph BEFORE any hex work exists (D1). Every rejection
 * carries a human-readable reason — this is what the debug panel (G5) shows
 * and what makes a rejection explainable as a sentence rather than a
 * threshold number.
 */
export function lintRegionGraph(
  graph: RegionTopologyGraph,
  grammarIds: GrammarId[],
): GraphLintResult {
  const adjacency = buildOpenAdjacency(graph);

  const entryNodes = graph.nodes.filter((node) => node.role === 'ENTRY');
  if (entryNodes.length !== 1) {
    return {
      ok: false,
      reason: `graph must have exactly one ENTRY node, found ${entryNodes.length}`,
    };
  }
  const reachableFromEntry = reachableFrom(adjacency, entryNodes[0].id);

  const portals = graph.nodes.filter((node) => node.role === 'PORTAL');
  if (portals.length === 0) {
    return { ok: false, reason: 'graph has no PORTAL node' };
  }
  for (const portal of portals) {
    if (!reachableFromEntry.has(portal.id)) {
      return { ok: false, reason: `PORTAL "${portal.id}" is not reachable from ENTRY` };
    }
  }

  for (const node of graph.nodes) {
    if (node.role !== 'FORK') continue;

    const branches = adjacency.get(node.id) ?? [];
    if (branches.length < 2) {
      return { ok: false, reason: `FORK node "${node.id}" has fewer than 2 open branches` };
    }

    const outcomes = [...computeForkBranchOutcomes(graph, node.id).values()];
    for (let i = 0; i < outcomes.length; i += 1) {
      for (let j = i + 1; j < outcomes.length; j += 1) {
        if (!branchOutcomesDiffer(outcomes[i], outcomes[j])) {
          return {
            ok: false,
            reason: `FORK node "${node.id}" has two branches with identical outcomes — a fork without a real difference between its branches`,
          };
        }
      }
    }
  }

  for (const nodeId of reachableFromEntry) {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node || node.role === 'PORTAL') continue;

    const hasOpenExit = (adjacency.get(nodeId) ?? []).length > 0;
    if (!hasOpenExit && node.role !== 'POI' && node.role !== 'LANDMARK') {
      return {
        ok: false,
        reason: `node "${nodeId}" (${node.role}) is a dead end with no POI or LANDMARK to justify it`,
      };
    }
  }

  const presentRoles = new Set(graph.nodes.map((node) => node.role));
  for (const grammarId of grammarIds) {
    const missing = GRAMMAR_REQUIRED_ROLES[grammarId].filter((role) => !presentRoles.has(role));
    if (missing.length) {
      return {
        ok: false,
        reason: `grammar "${grammarId}" requires role(s) ${missing.join(', ')}, missing from the graph`,
      };
    }
  }

  const pathSegmentShare =
    graph.nodes.filter((node) => node.role === 'PATH_SEGMENT').length / graph.nodes.length;
  if (pathSegmentShare > PATH_SEGMENT_SHARE_CEILING) {
    return {
      ok: false,
      reason: `PATH_SEGMENT nodes are ${(pathSegmentShare * 100).toFixed(0)}% of the graph — this reads as a trail, not a board`,
    };
  }

  return { ok: true };
}
