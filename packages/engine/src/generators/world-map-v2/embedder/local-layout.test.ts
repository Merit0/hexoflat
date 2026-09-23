import { describe, expect, it } from 'vitest';
import type { RegionTopologyGraph } from '../region-topology';
import { computeOpenNodeLayout } from './local-layout';

function cubeDistance(a: { q: number; r: number }, b: { q: number; r: number }): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -a.q - a.r - (-b.q - b.r);
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

const forkGraph: RegionTopologyGraph = {
  nodes: [
    { id: 'entry', role: 'ENTRY' },
    { id: 'fork', role: 'FORK' },
    { id: 'a', role: 'TRANSIT' },
    { id: 'b', role: 'TRANSIT' },
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

describe('computeOpenNodeLayout', () => {
  it('places ENTRY at the origin', () => {
    const positions = computeOpenNodeLayout(forkGraph, 'entry');
    expect(positions.get('entry')).toEqual({ q: 0, r: 0 });
  });

  it('gives every node a position', () => {
    const positions = computeOpenNodeLayout(forkGraph, 'entry');
    for (const node of forkGraph.nodes) {
      expect(positions.has(node.id)).toBe(true);
    }
  });

  it('spreads the two fork branches to different lanes (different q at the same depth)', () => {
    const positions = computeOpenNodeLayout(forkGraph, 'entry');
    const a = positions.get('a')!;
    const b = positions.get('b')!;
    expect(a.r).toBe(b.r);
    expect(a.q).not.toBe(b.q);
  });

  it('pulls the MERGE node back to lane 0', () => {
    const positions = computeOpenNodeLayout(forkGraph, 'entry');
    expect(positions.get('merge')!.q).toBe(0);
  });

  it('gives every node a distinct position (no two nodes share a hex)', () => {
    const positions = computeOpenNodeLayout(forkGraph, 'entry');
    const keys = [...positions.values()].map((p) => `${p.q}:${p.r}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every direct parent-child pair without a fork/merge in between is hex-adjacent', () => {
    // e1 (fork->a) and e3 (fork->b) are fork branches: distance 1 by
    // construction. e0 (entry->fork) is a straight single-child edge:
    // always distance 1.
    const positions = computeOpenNodeLayout(forkGraph, 'entry');
    expect(cubeDistance(positions.get('entry')!, positions.get('fork')!)).toBe(1);
    expect(cubeDistance(positions.get('fork')!, positions.get('a')!)).toBe(1);
    expect(cubeDistance(positions.get('fork')!, positions.get('b')!)).toBe(1);
  });

  it('is deterministic', () => {
    const first = computeOpenNodeLayout(forkGraph, 'entry');
    const second = computeOpenNodeLayout(forkGraph, 'entry');
    expect([...first.entries()]).toEqual([...second.entries()]);
  });
});
