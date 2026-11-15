import { describe, expect, it } from 'vitest';
import { seekerOpenChest } from './seeker-actions';
import { inventoryWith } from './quest-test-setup';
import { followTruth, must, startQuest } from './seeker-test-setup';

describe('CH-P7 the chest keeps its loot only in the stored container', () => {
  it('20 seeds: a new run has container contents and no chest.drop', () => {
    for (let i = 0; i < 20; i += 1) {
      const chest = followTruth(startQuest('seeker-1', `p7-contents-${i}`), 10).run.chest!;
      expect(chest.drop, `seed ${i}`).toBeUndefined();
      expect(chest.container?.contents?.[0]?.length, `seed ${i}`).toBeGreaterThan(0);
    }
  });

  it('a saved run that has only chest.drop opens with the same loot as its container', () => {
    for (let i = 0; i < 20; i += 1) {
      const state = startQuest('seeker-1', `p7-old-${i}`);
      const end = followTruth(state, 10);
      const drop = end.run.chest!.container!.contents![0];
      const legacy = structuredClone(end.run);
      legacy.chest!.drop = drop;
      delete legacy.chest!.container;
      const fresh = must(
        seekerOpenChest(end.progress, end.run, state.board, {
          inventory: inventoryWith({}),
          tableId: 'seeker-1-chest-loot',
        }),
      );
      const old = must(
        seekerOpenChest(end.progress, legacy, state.board, {
          inventory: inventoryWith({}),
          tableId: 'seeker-1-chest-loot',
        }),
      );
      expect(old.events[0].payload, `seed ${i}`).toEqual(fresh.events[0].payload);
    }
  });
});
