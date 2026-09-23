import type { SeededRandom } from '../../../utils/random-seeded';
import type { RegionTopologyGraph } from '../region-topology';
import { pickInt } from './grammar-utils';

/**
 * ENTRY -> FORK -> {DIRECT, DETOUR(POI)} -> MERGE -> PORTAL (plan §2.5).
 *
 * The two branches converge on the same single PORTAL, so `exitsReached`
 * never tells them apart — the fork is meaningful because DETOUR always
 * touches exactly one POI that DIRECT never does (poiTouched differs by
 * construction, not by chance of the rng draw).
 */
export function buildRouteForkGraph(rng: SeededRandom): RegionTopologyGraph {
  const directLength = pickInt(rng, 1, 2);
  const detourLength = pickInt(rng, 1, 2);
  const poiIndex = pickInt(rng, 0, detourLength - 1);

  const nodes: RegionTopologyGraph['nodes'] = [
    { id: 'entry', role: 'ENTRY' },
    { id: 'fork', role: 'FORK' },
    { id: 'merge', role: 'MERGE' },
    { id: 'portal', role: 'PORTAL' },
  ];
  const edges: RegionTopologyGraph['edges'] = [
    {
      id: 'entry-fork',
      from: 'entry',
      to: 'fork',
      traversal: 'OPEN',
      semanticRole: 'MAIN',
      weight: 1,
    },
    {
      id: 'merge-portal',
      from: 'merge',
      to: 'portal',
      traversal: 'OPEN',
      semanticRole: 'MAIN',
      weight: 1,
    },
  ];

  let previous = 'fork';
  for (let i = 0; i < directLength; i += 1) {
    const id = `direct-${i}`;
    nodes.push({ id, role: 'TRANSIT' });
    edges.push({
      id: `${previous}-${id}`,
      from: previous,
      to: id,
      traversal: 'OPEN',
      semanticRole: 'MAIN',
      weight: 1,
    });
    previous = id;
  }
  edges.push({
    id: `${previous}-merge`,
    from: previous,
    to: 'merge',
    traversal: 'OPEN',
    semanticRole: 'MAIN',
    weight: 1,
  });

  previous = 'fork';
  for (let i = 0; i < detourLength; i += 1) {
    const id = `detour-${i}`;
    nodes.push({ id, role: i === poiIndex ? 'POI' : 'TRANSIT' });
    edges.push({
      id: `${previous}-${id}`,
      from: previous,
      to: id,
      traversal: 'OPEN',
      semanticRole: 'DETOUR',
      weight: 1,
    });
    previous = id;
  }
  edges.push({
    id: `${previous}-merge-detour`,
    from: previous,
    to: 'merge',
    traversal: 'OPEN',
    semanticRole: 'DETOUR',
    weight: 1,
  });

  return { nodes, edges };
}
