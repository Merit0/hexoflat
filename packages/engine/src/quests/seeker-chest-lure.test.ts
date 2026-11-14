import { describe, expect, it } from 'vitest';
import { projectQuestForClient } from './projection';
import { inventoryWith } from './quest-test-setup';
import { seekerOpenChest } from './seeker-chest';
import { followTruth, openChestOf, startQuest } from './seeker-test-setup';
import { fullBag } from '../trade/trade-test-setup';

function pair(seed: string) {
  const state = startQuest('seeker-1', seed);
  const end = followTruth(state, 10);
  const real = structuredClone(end.run);
  const lure = structuredClone(end.run);
  lure.chest = { ...lure.chest!, kind: 'lure' };
  delete lure.chest.drop;
  return { state, end, real, lure };
}

describe('REQ-QST-026 a lure chest refuses like a real one', () => {
  it('every refusal is identical for both kinds', () => {
    const { state, end, real, lure } = pair('lure-same');
    const far = (run: typeof real) => {
      const copy = structuredClone(run);
      copy.chest = { ...copy.chest!, hex: state.run.start };
      return copy;
    };
    const ended = (run: typeof real) => ({ ...structuredClone(run), phase: 'ended' as const });
    const open = (run: typeof real, inventory = inventoryWith({})) =>
      openChestOf(state, { progress: end.progress, run }, inventory);
    const scenarios: [string, (run: typeof real) => unknown][] = [
      ['NOT_ADJACENT', (run) => open(far(run))],
      ['WRONG_PHASE', (run) => open(ended(run))],
      [
        'NO_INVENTORY',
        (run) =>
          seekerOpenChest(end.progress, run, state.board, {
            inventory: undefined,
            tableId: 'seeker-1-chest-loot',
          }),
      ],
    ];
    for (const [name, run] of scenarios) {
      const a = run(real) as { ok: boolean };
      const b = run(lure) as { ok: boolean };
      expect(a.ok, name).toBe(false);
      expect(JSON.stringify(b), name).toBe(JSON.stringify(a));
    }
    expect(open(real, fullBag())).toMatchObject({ ok: true });
    expect(open(lure, fullBag())).toMatchObject({ ok: true });
  });

  it('the projection before OPEN does not tell the kinds apart', () => {
    const { real, lure } = pair('lure-projection');
    expect(JSON.stringify(projectQuestForClient(lure))).toBe(
      JSON.stringify(projectQuestForClient(real)),
    );
  });

  it('only the success branch differs: the lure springs the ambush', () => {
    const { state, end, lure } = pair('lure-branch');
    const sprung = openChestOf(state, { progress: end.progress, run: lure });
    expect(sprung).toMatchObject({ ok: true });
    expect(sprung.ok && sprung.run.phase).toBe('ambush');
  });
});
