import { describe, expect, it } from 'vitest';
import { RegionPropositionSchema, RegionTopologyGraphSchema } from './region-topology';

function validGraph() {
  return {
    nodes: [
      { id: 'entry', role: 'ENTRY' },
      { id: 'fork', role: 'FORK' },
      { id: 'portal', role: 'PORTAL' },
    ],
    edges: [
      { id: 'e1', from: 'entry', to: 'fork', traversal: 'OPEN', semanticRole: 'MAIN', weight: 2 },
      {
        id: 'e2',
        from: 'fork',
        to: 'portal',
        traversal: 'OPEN',
        semanticRole: 'MAIN',
        weight: 3,
      },
    ],
  };
}

describe('RegionTopologyGraphSchema', () => {
  it('accepts a well-formed graph', () => {
    expect(RegionTopologyGraphSchema.safeParse(validGraph()).success).toBe(true);
  });

  it('rejects a graph with no nodes', () => {
    const result = RegionTopologyGraphSchema.safeParse({ nodes: [], edges: [] });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown node role', () => {
    const graph = validGraph();
    graph.nodes[0] = { id: 'entry', role: 'NOT_A_ROLE' };

    expect(RegionTopologyGraphSchema.safeParse(graph).success).toBe(false);
  });

  it('rejects an unknown edge semantic role', () => {
    const graph = validGraph();
    graph.edges[0] = { ...graph.edges[0], semanticRole: 'SIDEWAYS' };

    expect(RegionTopologyGraphSchema.safeParse(graph).success).toBe(false);
  });

  it('rejects duplicate node ids', () => {
    const graph = validGraph();
    graph.nodes.push({ id: 'entry', role: 'TRANSIT' });

    expect(RegionTopologyGraphSchema.safeParse(graph).success).toBe(false);
  });

  it('rejects an edge referencing a node id that does not exist', () => {
    const graph = validGraph();
    graph.edges.push({
      id: 'e3',
      from: 'fork',
      to: 'ghost-node',
      traversal: 'OPEN',
      semanticRole: 'MAIN',
      weight: 1,
    });

    expect(RegionTopologyGraphSchema.safeParse(graph).success).toBe(false);
  });
});

describe('RegionPropositionSchema', () => {
  it('accepts a well-formed proposition', () => {
    const proposition = {
      boardSeed: 'abc123',
      attemptIndex: 0,
      profile: 'WORLD',
      grammarIds: ['ROUTE_FORK'],
      graph: validGraph(),
    };

    expect(RegionPropositionSchema.safeParse(proposition).success).toBe(true);
  });

  it('rejects an empty grammarIds list', () => {
    const proposition = {
      boardSeed: 'abc123',
      attemptIndex: 0,
      profile: 'WORLD',
      grammarIds: [],
      graph: validGraph(),
    };

    expect(RegionPropositionSchema.safeParse(proposition).success).toBe(false);
  });

  it('rejects a negative attemptIndex', () => {
    const proposition = {
      boardSeed: 'abc123',
      attemptIndex: -1,
      profile: 'WORLD',
      grammarIds: ['BASIN'],
      graph: validGraph(),
    };

    expect(RegionPropositionSchema.safeParse(proposition).success).toBe(false);
  });
});
