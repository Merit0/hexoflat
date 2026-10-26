import { describe, expect, it } from 'vitest';
import { buildSkillTreeView, previewSacrifice } from './skill-tree-view';

const input = (ranks: Record<string, number>, will: number, locked: boolean, progress = {}) => ({
  ranks,
  progress,
  will: { current: will, capacity: 50 },
  locked,
});

const branch = (view: ReturnType<typeof buildSkillTreeView>, id: string) =>
  view.branches.find((b) => b.id === id)!;

describe('buildSkillTreeView', () => {
  it('orders the schools demonic, bionic, angelic with the full node layout', () => {
    const view = buildSkillTreeView(input({}, 20, false));
    expect(view.branches.map((b) => b.id)).toEqual(['demonic', 'bionic', 'angelic']);
    const bionic = branch(view, 'bionic');
    expect(bionic.crest.id).toBe('b_crest');
    expect(bionic.rows.map((row) => row.map((n) => n.id))).toEqual([
      ['b_strike', 'b_guard'],
      ['b_heavy', 'b_endure'],
      ['b_dash', 'b_aim'],
    ]);
    expect(bionic.cap.id).toBe('b_cap');
  });

  it('shows the bionic crest unlocked and its fork lit from the start', () => {
    const bionic = branch(buildSkillTreeView(input({}, 20, false)), 'bionic');
    expect(bionic.crest).toMatchObject({ rank: 1, status: 'max' });
    expect(bionic.forkLit).toBe(true);
    expect(bionic.rows[0][0]).toMatchObject({ status: 'ready', nextCost: 6, parentLit: true });
  });

  it('keeps other schools closed until their crest is bought', () => {
    const angelic = branch(buildSkillTreeView(input({}, 50, false)), 'angelic');
    expect(angelic.forkLit).toBe(false);
    expect(angelic.crest).toMatchObject({ rank: 0, status: 'ready', nextCost: 1000 });
    expect(angelic.rows[0][0]).toMatchObject({
      id: 'a_teleport',
      status: 'requires',
      parentLit: false,
    });

    const awake = branch(buildSkillTreeView(input({ a_crest: 1 }, 50, false)), 'angelic');
    expect(awake.forkLit).toBe(true);
    expect(awake.rows[0][0]).toMatchObject({ status: 'ready', nextCost: 500, parentLit: true });
  });

  it('marks unimplemented nodes as soon even when their parents are open', () => {
    const bionic = branch(buildSkillTreeView(input({ b_strike: 1 }, 50, false)), 'bionic');
    expect(bionic.rows[1][0]).toMatchObject({ id: 'b_heavy', status: 'soon', parentLit: true });
  });

  it('reports need-will and locked from Will and the movement/combat lock', () => {
    expect(branch(buildSkillTreeView(input({}, 0, false)), 'bionic').rows[0][0].status).toBe(
      'need-will',
    );
    expect(branch(buildSkillTreeView(input({}, 50, true)), 'bionic').rows[0][0].status).toBe(
      'locked',
    );
  });

  it('lights the cap line only when both third-row nodes are open', () => {
    expect(branch(buildSkillTreeView(input({ b_dash: 1 }, 0, false)), 'bionic').capLit).toBe(false);
    expect(
      branch(buildSkillTreeView(input({ b_dash: 1, b_aim: 1 }, 0, false)), 'bionic').capLit,
    ).toBe(true);
  });
});

describe('sacrifice view', () => {
  it('offers the three options scaled by the hero capacity', () => {
    const view = buildSkillTreeView({
      ranks: {},
      progress: {},
      will: { current: 100, capacity: 100 },
      locked: false,
    });
    expect(view.options.map((o) => o.amount)).toEqual([30, 60, 100]);
    expect(view.options.every((o) => o.affordable)).toBe(true);
  });

  it('carries the stored progress on each node', () => {
    const view = buildSkillTreeView(input({ a_crest: 1 }, 50, false, { a_teleport: 120 }));
    expect(branch(view, 'angelic').rows[0][0]).toMatchObject({
      id: 'a_teleport',
      progress: 120,
      nextCost: 500,
    });
  });

  it('previews the bar after a sacrifice, including a rank carry-over', () => {
    const node = branch(buildSkillTreeView(input({ a_crest: 1 }, 50, false)), 'angelic').rows[0][0];
    expect(previewSacrifice(node, 30)).toEqual({
      rank: 0,
      progress: 30,
      cost: 500,
      ranksGained: 0,
    });
    const strike = branch(buildSkillTreeView(input({}, 50, false)), 'bionic').rows[0][0];
    expect(previewSacrifice(strike, 15)).toEqual({
      rank: 2,
      progress: 3,
      cost: 8,
      ranksGained: 2,
    });
  });
});
