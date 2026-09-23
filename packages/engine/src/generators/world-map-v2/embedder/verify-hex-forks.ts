import type { RegionTopologyGraph } from '../region-topology';
import type { AreaLink, ContractedGraph } from './contract-path-segments';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';

interface HexBranchOutcome {
  hexCount: number;
  touchesPoi: boolean;
  portalIds: string[];
}

function reachableAreaIds(links: AreaLink[], startId: string): Set<string> {
  const successors = new Map<string, string[]>();
  for (const link of links) {
    successors.set(link.from, [...(successors.get(link.from) ?? []), link.to]);
  }
  const seen = new Set([startId]);
  const queue = [startId];
  while (queue.length) {
    const current = queue.shift() as string;
    for (const next of successors.get(current) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

function outcomesDiffer(a: HexBranchOutcome, b: HexBranchOutcome): boolean {
  if (a.hexCount !== b.hexCount) return true;
  if (a.touchesPoi !== b.touchesPoi) return true;
  if (a.portalIds.length !== b.portalIds.length) return true;
  return a.portalIds.some((id, index) => id !== b.portalIds[index]);
}

/**
 * Re-verifies fork meaningfulness at the hex level (plan G2b step 6) — G1's
 * `branchOutcomesDiffer` already proved this on the abstract graph, but
 * growth and link carving happen after that check, so this proves the
 * built board didn't accidentally erase the difference (e.g. two branches
 * ending up with visually identical hex footprints).
 */
export function verifyForksMeaningfulInHexes(
  graph: RegionTopologyGraph,
  contracted: ContractedGraph,
  passableByArea: Map<string, Set<string>>,
  linkCells: Map<string, IHexCoordinates[]>,
): { ok: true } | { ok: false; reason: string } {
  const roleById = new Map(graph.nodes.map((node) => [node.id, node.role]));
  const outgoingByArea = new Map<string, AreaLink[]>();
  for (const link of contracted.links) {
    outgoingByArea.set(link.from, [...(outgoingByArea.get(link.from) ?? []), link]);
  }

  for (const node of contracted.areaNodes) {
    if (node.role !== 'FORK') continue;
    const branches = outgoingByArea.get(node.id) ?? [];
    if (branches.length < 2) continue;

    const reachablePerBranch = branches.map((branch) =>
      reachableAreaIds(contracted.links, branch.to),
    );

    const outcomes: HexBranchOutcome[] = branches.map((branch, index) => {
      const own = reachablePerBranch[index];
      const others = reachablePerBranch.filter((_, otherIndex) => otherIndex !== index);
      const exclusive = [...own].filter((id) => !others.some((set) => set.has(id)));

      const hexCount =
        exclusive.reduce((sum, id) => sum + (passableByArea.get(id)?.size ?? 0), 0) +
        (linkCells.get(branch.id)?.length ?? 0);
      const touchesPoi = exclusive.some((id) => roleById.get(id) === 'POI');
      const portalIds = exclusive.filter((id) => roleById.get(id) === 'PORTAL').sort();

      return { hexCount, touchesPoi, portalIds };
    });

    for (let i = 0; i < outcomes.length; i += 1) {
      for (let j = i + 1; j < outcomes.length; j += 1) {
        if (!outcomesDiffer(outcomes[i], outcomes[j])) {
          return {
            ok: false,
            reason: `FORK "${node.id}" has two branches with identical hex-level outcomes (${outcomes[i].hexCount} hexes each) — the graph-level difference didn't survive embedding`,
          };
        }
      }
    }
  }

  return { ok: true };
}
