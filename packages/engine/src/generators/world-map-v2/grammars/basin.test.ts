import { describe, expect, it } from 'vitest';
import { deriveStream } from '../../../utils/random-seeded';
import { RegionTopologyGraphSchema } from '../region-topology';
import { lintRegionGraph } from '../graph-linter';
import { computeForkBranchOutcomes, branchOutcomesDiffer } from '../branch-outcome';
import { buildBasinGraph } from './basin';

describe('buildBasinGraph', () => {
  it('produces a schema-valid graph', () => {
    const graph = buildBasinGraph(deriveStream('seed-1', 'grammar-build'));
    expect(RegionTopologyGraphSchema.safeParse(graph).success).toBe(true);
  });

  it('is deterministic for the same rng seed', () => {
    const a = buildBasinGraph(deriveStream('seed-1', 'grammar-build'));
    const b = buildBasinGraph(deriveStream('seed-1', 'grammar-build'));
    expect(a).toEqual(b);
  });

  it('passes the graph linter', () => {
    for (let i = 0; i < 30; i += 1) {
      const graph = buildBasinGraph(deriveStream(`seed-${i}`, 'grammar-build'));
      expect(lintRegionGraph(graph, ['BASIN'])).toEqual({ ok: true });
    }
  });

  it('the obstruction is not reachable from ENTRY (it is a wall, not a route)', () => {
    const graph = buildBasinGraph(deriveStream('seed-1', 'grammar-build'));
    expect(graph.nodes.some((n) => n.id === 'obstruction' && n.role === 'OBSTRUCTION')).toBe(true);
    const obstructionEdge = graph.edges.find((e) => e.to === 'obstruction');
    expect(obstructionEdge?.traversal).toBe('BLOCKED');
  });

  it('the two branches always reach a different portal', () => {
    for (let i = 0; i < 30; i += 1) {
      const graph = buildBasinGraph(deriveStream(`seed-${i}`, 'grammar-build'));
      const outcomes = [...computeForkBranchOutcomes(graph, 'basin').values()];
      expect(outcomes).toHaveLength(2);
      expect(outcomes[0].exitsReached).not.toEqual(outcomes[1].exitsReached);
      expect(branchOutcomesDiffer(outcomes[0], outcomes[1])).toBe(true);
    }
  });
});
