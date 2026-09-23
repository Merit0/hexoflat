import type { SeededRandom } from '../../../utils/random-seeded';
import type { RegionTopologyGraph } from '../region-topology';
import { pickInt } from './grammar-utils';

/**
 * ENTRY -> NECK -> BASIN(obstruction inside) -> {PORTAL_A, PORTAL_B} (plan
 * §2.5). NECK is a `PATH_SEGMENT` — a deliberate narrow choke, not filler.
 * BASIN is the fork point (role `FORK`): the two branches always reach a
 * different PORTAL, so `exitsReached` alone makes the fork meaningful
 * regardless of branch length — "which side to go around" (§2.6.3).
 */
export function buildBasinGraph(rng: SeededRandom): RegionTopologyGraph {
  const neckLength = pickInt(rng, 1, 2);
  const branchALength = pickInt(rng, 0, 1);
  const branchBLength = pickInt(rng, 0, 1);

  const nodes: RegionTopologyGraph['nodes'] = [
    { id: 'entry', role: 'ENTRY' },
    { id: 'basin', role: 'FORK' },
    { id: 'obstruction', role: 'OBSTRUCTION' },
  ];
  const edges: RegionTopologyGraph['edges'] = [
    {
      id: 'basin-obstruction',
      from: 'basin',
      to: 'obstruction',
      traversal: 'BLOCKED',
      semanticRole: 'MAIN',
      weight: 1,
    },
  ];

  let previous = 'entry';
  for (let i = 0; i < neckLength; i += 1) {
    const id = `neck-${i}`;
    nodes.push({ id, role: 'PATH_SEGMENT' });
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
    id: `${previous}-basin`,
    from: previous,
    to: 'basin',
    traversal: 'OPEN',
    semanticRole: 'MAIN',
    weight: 1,
  });

  for (const [suffix, length] of [
    ['a', branchALength],
    ['b', branchBLength],
  ] as const) {
    let branchPrevious = 'basin';
    for (let i = 0; i < length; i += 1) {
      const id = `approach-${suffix}-${i}`;
      nodes.push({ id, role: 'TRANSIT' });
      edges.push({
        id: `${branchPrevious}-${id}`,
        from: branchPrevious,
        to: id,
        traversal: 'OPEN',
        semanticRole: 'MAIN',
        weight: 1,
      });
      branchPrevious = id;
    }
    const portalId = `portal-${suffix}`;
    nodes.push({ id: portalId, role: 'PORTAL' });
    edges.push({
      id: `${branchPrevious}-${portalId}`,
      from: branchPrevious,
      to: portalId,
      traversal: 'OPEN',
      semanticRole: 'MAIN',
      weight: 1,
    });
  }

  return { nodes, edges };
}
