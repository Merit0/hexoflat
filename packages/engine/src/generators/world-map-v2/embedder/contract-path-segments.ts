import type { RegionGraphNode, RegionTopologyGraph } from '../region-topology';

export interface AreaLink {
  /** The graph edge id that starts this link (its ENTRY edge if a PATH_SEGMENT chain was contracted). */
  id: string;
  from: string;
  to: string;
  /** Passed through one or more PATH_SEGMENT nodes — gets a longer carved passage (2-4 hexes vs 1-3). */
  isLong: boolean;
}

export interface ContractedGraph {
  /** Every node that becomes its own grown area — everything except PATH_SEGMENT and OBSTRUCTION. */
  areaNodes: RegionGraphNode[];
  /** Area-to-area connections, with PATH_SEGMENT chains collapsed into one longer link. */
  links: AreaLink[];
  /** host area node id -> the OBSTRUCTION node id BLOCKED-attached to it. */
  obstructionByHost: Map<string, string>;
}

/**
 * `PATH_SEGMENT` is a legal graph role (a deliberate narrow neck) but not an
 * area of its own (plan G2b): it becomes part of the LINK between the areas
 * on either side of it, just a longer one. `OBSTRUCTION` never was an area
 * (G2) — it's carved as a blocked cluster inside its host's area. Both are
 * stripped out here so everything downstream only ever deals in areas and
 * links between them.
 */
export function contractPathSegments(graph: RegionTopologyGraph): ContractedGraph {
  const roleById = new Map(graph.nodes.map((node) => [node.id, node.role]));
  const areaNodes = graph.nodes.filter(
    (node) => node.role !== 'PATH_SEGMENT' && node.role !== 'OBSTRUCTION',
  );

  const openSuccessors = new Map<string, { id: string; to: string }[]>();
  for (const edge of graph.edges) {
    if (edge.traversal !== 'OPEN') continue;
    openSuccessors.set(edge.from, [
      ...(openSuccessors.get(edge.from) ?? []),
      { id: edge.id, to: edge.to },
    ]);
  }

  const obstructionByHost = new Map<string, string>();
  for (const edge of graph.edges) {
    if (edge.traversal === 'BLOCKED') obstructionByHost.set(edge.from, edge.to);
  }

  const links: AreaLink[] = [];
  for (const areaNode of areaNodes) {
    for (const outEdge of openSuccessors.get(areaNode.id) ?? []) {
      let current = outEdge.to;
      let hops = 1;
      while (roleById.get(current) === 'PATH_SEGMENT') {
        const next = (openSuccessors.get(current) ?? [])[0];
        if (!next) break;
        current = next.to;
        hops += 1;
      }
      links.push({ id: outEdge.id, from: areaNode.id, to: current, isLong: hops > 1 });
    }
  }

  return { areaNodes, links, obstructionByHost };
}
