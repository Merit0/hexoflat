import { describe, expect, it } from 'vitest';
import { buildSkillTreeView } from './skill-tree-view';

const branch = (view: ReturnType<typeof buildSkillTreeView>, id: string) =>
  view.branches.find((b) => b.id === id)!;

describe('buildSkillTreeView', () => {
  it('orders the schools demonic, bionic, angelic with the full node layout', () => {
    const view = buildSkillTreeView({}, 20, false);
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
    const bionic = branch(buildSkillTreeView({}, 20, false), 'bionic');
    expect(bionic.crest).toMatchObject({ rank: 1, status: 'max' });
    expect(bionic.forkLit).toBe(true);
    expect(bionic.rows[0][0]).toMatchObject({ status: 'ready', nextCost: 6, parentLit: true });
  });

  it('keeps other schools closed until their crest is bought', () => {
    const angelic = branch(buildSkillTreeView({}, 50, false), 'angelic');
    expect(angelic.forkLit).toBe(false);
    expect(angelic.crest).toMatchObject({ rank: 0, status: 'ready', nextCost: 10 });
    expect(angelic.rows[0][0]).toMatchObject({
      id: 'a_teleport',
      status: 'requires',
      parentLit: false,
    });

    const awake = branch(buildSkillTreeView({ a_crest: 1 }, 50, false), 'angelic');
    expect(awake.forkLit).toBe(true);
    expect(awake.rows[0][0]).toMatchObject({ status: 'ready', parentLit: true });
  });

  it('marks unimplemented nodes as soon even when their parents are open', () => {
    const bionic = branch(buildSkillTreeView({ b_strike: 1 }, 50, false), 'bionic');
    expect(bionic.rows[1][0]).toMatchObject({ id: 'b_heavy', status: 'soon', parentLit: true });
  });

  it('reports need-will and locked from Will and the movement/combat lock', () => {
    expect(branch(buildSkillTreeView({}, 5, false), 'bionic').rows[0][0].status).toBe('need-will');
    expect(branch(buildSkillTreeView({}, 50, true), 'bionic').rows[0][0].status).toBe('locked');
  });

  it('lights the cap line only when both third-row nodes are open', () => {
    expect(branch(buildSkillTreeView({ b_dash: 1 }, 0, false), 'bionic').capLit).toBe(false);
    expect(branch(buildSkillTreeView({ b_dash: 1, b_aim: 1 }, 0, false), 'bionic').capLit).toBe(
      true,
    );
  });
});
