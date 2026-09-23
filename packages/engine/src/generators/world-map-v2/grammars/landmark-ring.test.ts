import { describe, expect, it } from 'vitest';
import { deriveStream } from '../../../utils/random-seeded';
import { RegionTopologyGraphSchema } from '../region-topology';
import { lintRegionGraph } from '../graph-linter';
import { computeForkBranchOutcomes, branchOutcomesDiffer } from '../branch-outcome';
import { buildLandmarkRingGraph } from './landmark-ring';

describe('buildLandmarkRingGraph', () => {
  it('produces a schema-valid graph', () => {
    const graph = buildLandmarkRingGraph(deriveStream('seed-1', 'grammar-build'));
    expect(RegionTopologyGraphSchema.safeParse(graph).success).toBe(true);
  });

  it('is deterministic for the same rng seed', () => {
    const a = buildLandmarkRingGraph(deriveStream('seed-1', 'grammar-build'));
    const b = buildLandmarkRingGraph(deriveStream('seed-1', 'grammar-build'));
    expect(a).toEqual(b);
  });

  it('passes the graph linter', () => {
    for (let i = 0; i < 30; i += 1) {
      const graph = buildLandmarkRingGraph(deriveStream(`seed-${i}`, 'grammar-build'));
      expect(lintRegionGraph(graph, ['LANDMARK_RING'])).toEqual({ ok: true });
    }
  });

  it('the two approaches converge on the same landmark and portal, but never tie in length', () => {
    for (let i = 0; i < 30; i += 1) {
      const graph = buildLandmarkRingGraph(deriveStream(`seed-${i}`, 'grammar-build'));
      const outcomes = [...computeForkBranchOutcomes(graph, 'fork').values()];
      expect(outcomes).toHaveLength(2);
      expect(outcomes[0].exitsReached).toEqual(['portal']);
      expect(outcomes[1].exitsReached).toEqual(['portal']);
      expect(outcomes[0].pathHexes).not.toBe(outcomes[1].pathHexes);
      expect(branchOutcomesDiffer(outcomes[0], outcomes[1])).toBe(true);
    }
  });
});
