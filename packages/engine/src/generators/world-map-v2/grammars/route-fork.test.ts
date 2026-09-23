import { describe, expect, it } from 'vitest';
import { deriveStream } from '../../../utils/random-seeded';
import { RegionTopologyGraphSchema } from '../region-topology';
import { lintRegionGraph } from '../graph-linter';
import { computeForkBranchOutcomes, branchOutcomesDiffer } from '../branch-outcome';
import { buildRouteForkGraph } from './route-fork';

describe('buildRouteForkGraph', () => {
  it('produces a schema-valid graph', () => {
    const graph = buildRouteForkGraph(deriveStream('seed-1', 'grammar-build'));
    expect(RegionTopologyGraphSchema.safeParse(graph).success).toBe(true);
  });

  it('is deterministic for the same rng seed', () => {
    const a = buildRouteForkGraph(deriveStream('seed-1', 'grammar-build'));
    const b = buildRouteForkGraph(deriveStream('seed-1', 'grammar-build'));
    expect(a).toEqual(b);
  });

  it('passes the graph linter', () => {
    for (let i = 0; i < 30; i += 1) {
      const graph = buildRouteForkGraph(deriveStream(`seed-${i}`, 'grammar-build'));
      expect(lintRegionGraph(graph, ['ROUTE_FORK'])).toEqual({ ok: true });
    }
  });

  it('DETOUR always touches exactly one more POI than DIRECT', () => {
    for (let i = 0; i < 30; i += 1) {
      const graph = buildRouteForkGraph(deriveStream(`seed-${i}`, 'grammar-build'));
      const outcomes = [...computeForkBranchOutcomes(graph, 'fork').values()];
      expect(outcomes).toHaveLength(2);
      const poiCounts = outcomes.map((o) => o.poiTouched).sort();
      expect(poiCounts).toEqual([0, 1]);
      expect(branchOutcomesDiffer(outcomes[0], outcomes[1])).toBe(true);
    }
  });

  it('both branches reach the same single portal', () => {
    const graph = buildRouteForkGraph(deriveStream('seed-1', 'grammar-build'));
    const outcomes = [...computeForkBranchOutcomes(graph, 'fork').values()];
    expect(outcomes[0].exitsReached).toEqual(['portal']);
    expect(outcomes[1].exitsReached).toEqual(['portal']);
  });
});
