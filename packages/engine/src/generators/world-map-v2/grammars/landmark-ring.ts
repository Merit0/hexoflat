import type { SeededRandom } from '../../../utils/random-seeded';
import type { RegionTopologyGraph } from '../region-topology';
import { pickInt } from './grammar-utils';

/**
 * ENTRY -> FORK -> {APPROACH_A, APPROACH_B} -> LANDMARK -> PORTAL (plan
 * §2.5). Both approaches converge on the same LANDMARK and PORTAL, so
 * neither `exitsReached` nor `poiTouched` ever tells them apart (LANDMARK is
 * its own role, not POI) — the fork's only available dimension is length,
 * so the two approach lengths are never allowed to end up equal: if the rng
 * draw ties them, one is bumped by one hex.
 */
export function buildLandmarkRingGraph(rng: SeededRandom): RegionTopologyGraph {
  const approachALength = pickInt(rng, 1, 2);
  let approachBLength = pickInt(rng, 1, 2);
  if (approachBLength === approachALength) approachBLength += 1;

  const nodes: RegionTopologyGraph['nodes'] = [
    { id: 'entry', role: 'ENTRY' },
    { id: 'fork', role: 'FORK' },
    { id: 'landmark', role: 'LANDMARK' },
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
      id: 'landmark-portal',
      from: 'landmark',
      to: 'portal',
      traversal: 'OPEN',
      semanticRole: 'MAIN',
      weight: 1,
    },
  ];

  for (const [suffix, length] of [
    ['a', approachALength],
    ['b', approachBLength],
  ] as const) {
    let previous = 'fork';
    for (let i = 0; i < length; i += 1) {
      const id = `approach-${suffix}-${i}`;
      nodes.push({ id, role: 'TRANSIT' });
      edges.push({
        id: `${previous}-${id}`,
        from: previous,
        to: id,
        traversal: 'OPEN',
        semanticRole: 'APPROACH',
        weight: 1,
      });
      previous = id;
    }
    edges.push({
      id: `${previous}-landmark-${suffix}`,
      from: previous,
      to: 'landmark',
      traversal: 'OPEN',
      semanticRole: 'APPROACH',
      weight: 1,
    });
  }

  return { nodes, edges };
}
