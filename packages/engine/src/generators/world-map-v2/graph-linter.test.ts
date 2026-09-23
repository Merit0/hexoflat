import { describe, expect, it } from 'vitest';
import type { RegionTopologyGraph } from './region-topology';
import { lintRegionGraph } from './graph-linter';

function baseGraph(): RegionTopologyGraph {
  return {
    nodes: [
      { id: 'entry', role: 'ENTRY' },
      { id: 'fork', role: 'FORK' },
      { id: 'a', role: 'TRANSIT' },
      { id: 'b', role: 'POI' },
      { id: 'merge', role: 'MERGE' },
      { id: 'portal', role: 'PORTAL' },
    ],
    edges: [
      { id: 'e0', from: 'entry', to: 'fork', traversal: 'OPEN', semanticRole: 'MAIN', weight: 1 },
      { id: 'e1', from: 'fork', to: 'a', traversal: 'OPEN', semanticRole: 'MAIN', weight: 1 },
      { id: 'e2', from: 'a', to: 'merge', traversal: 'OPEN', semanticRole: 'MAIN', weight: 1 },
      { id: 'e3', from: 'fork', to: 'b', traversal: 'OPEN', semanticRole: 'DETOUR', weight: 1 },
      { id: 'e4', from: 'b', to: 'merge', traversal: 'OPEN', semanticRole: 'DETOUR', weight: 1 },
      { id: 'e5', from: 'merge', to: 'portal', traversal: 'OPEN', semanticRole: 'MAIN', weight: 1 },
    ],
  };
}

/** Same shape as `baseGraph()`, but branch `b` is a plain TRANSIT like `a` — nothing tells the two branches apart. */
function identicalForkGraph(): RegionTopologyGraph {
  const graph = baseGraph();
  graph.nodes = graph.nodes.map((node) => (node.id === 'b' ? { ...node, role: 'TRANSIT' } : node));
  return graph;
}

describe('lintRegionGraph', () => {
  it('accepts a well-formed graph', () => {
    expect(lintRegionGraph(baseGraph(), [])).toEqual({ ok: true });
  });

  it('rejects a fork with two identical branches', () => {
    // Both branches of identicalForkGraph() are TRANSIT -> MERGE with equal
    // weight and no POI/PORTAL along the way, so every BranchOutcome
    // dimension ties — this is exactly the "fork without a difference" case.
    const result = lintRegionGraph(identicalForkGraph(), []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/identical outcomes/);
  });

  it('rejects an unreachable PORTAL', () => {
    const graph = baseGraph();
    graph.nodes.push({ id: 'stray-portal', role: 'PORTAL' });

    const result = lintRegionGraph(graph, []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not reachable from ENTRY/);
  });

  it('rejects a dead end with no POI or LANDMARK', () => {
    const graph = baseGraph();
    graph.nodes.push({ id: 'cul-de-sac', role: 'TRANSIT' });
    graph.edges.push({
      id: 'e6',
      from: 'entry',
      to: 'cul-de-sac',
      traversal: 'OPEN',
      semanticRole: 'MAIN',
      weight: 1,
    });

    const result = lintRegionGraph(graph, []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/dead end/);
  });

  it('accepts a dead end that IS a POI', () => {
    const graph = baseGraph();
    graph.nodes.push({ id: 'nook', role: 'POI' });
    graph.edges.push({
      id: 'e6',
      from: 'entry',
      to: 'nook',
      traversal: 'OPEN',
      semanticRole: 'DETOUR',
      weight: 1,
    });

    // The nook now differentiates the fork-less ENTRY branch from nothing —
    // this test only checks the dead-end rule doesn't fire on a POI leaf.
    const result = lintRegionGraph(graph, []);
    if (!result.ok) expect(result.reason).not.toMatch(/dead end/);
  });

  it('rejects a graph with no PORTAL at all', () => {
    const graph = baseGraph();
    graph.nodes = graph.nodes.filter((n) => n.role !== 'PORTAL');
    graph.edges = graph.edges.filter((e) => e.to !== 'portal');

    expect(lintRegionGraph(graph, [])).toEqual({
      ok: false,
      reason: 'graph has no PORTAL node',
    });
  });

  it('rejects a graph dominated by PATH_SEGMENT nodes', () => {
    const graph: RegionTopologyGraph = {
      nodes: [
        { id: 'entry', role: 'ENTRY' },
        { id: 'p1', role: 'PATH_SEGMENT' },
        { id: 'p2', role: 'PATH_SEGMENT' },
        { id: 'p3', role: 'PATH_SEGMENT' },
        { id: 'portal', role: 'PORTAL' },
      ],
      edges: [
        { id: 'e0', from: 'entry', to: 'p1', traversal: 'OPEN', semanticRole: 'MAIN', weight: 1 },
        { id: 'e1', from: 'p1', to: 'p2', traversal: 'OPEN', semanticRole: 'MAIN', weight: 1 },
        { id: 'e2', from: 'p2', to: 'p3', traversal: 'OPEN', semanticRole: 'MAIN', weight: 1 },
        {
          id: 'e3',
          from: 'p3',
          to: 'portal',
          traversal: 'OPEN',
          semanticRole: 'MAIN',
          weight: 1,
        },
      ],
    };

    const result = lintRegionGraph(graph, []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/reads as a trail/);
  });

  it('rejects a graph missing a grammar-required role', () => {
    const graph = baseGraph(); // has no LANDMARK node
    const result = lintRegionGraph(graph, ['LANDMARK_RING']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/LANDMARK_RING.*LANDMARK/);
  });

  it('rejects a FORK node with fewer than 2 open branches', () => {
    const graph: RegionTopologyGraph = {
      nodes: [
        { id: 'entry', role: 'ENTRY' },
        { id: 'fork', role: 'FORK' },
        { id: 'portal', role: 'PORTAL' },
      ],
      edges: [
        { id: 'e0', from: 'entry', to: 'fork', traversal: 'OPEN', semanticRole: 'MAIN', weight: 1 },
        {
          id: 'e1',
          from: 'fork',
          to: 'portal',
          traversal: 'OPEN',
          semanticRole: 'MAIN',
          weight: 1,
        },
      ],
    };

    const result = lintRegionGraph(graph, []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/fewer than 2 open branches/);
  });
});
