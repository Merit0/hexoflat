import { describe, expect, it } from 'vitest';
import { executePlayerCommand, type PlayerAggregates } from './execute-player-command';
import { emptyProgressState } from './progress-state';
import { inventoryWith, HERO } from '../trade/trade-test-setup';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';

function aggregates(): PlayerAggregates {
  const progress = emptyProgressState(HERO);
  return { inventory: inventoryWith({}), progress };
}

const ctx = (atBoard: boolean) => ({
  devGrantAllowed: false,
  inventory: { stashOpen: false, battleOpen: false },
  quest: { atBoard },
});

function command(type: 'QUEST_ACCEPT' | 'QUEST_CLAIM' | 'QUEST_ABANDON', revision: number) {
  return { type, payload: { heroId: HERO, revision, questId: 'woodcutter' } } as const;
}

describe('quest player commands', () => {
  it('accepts a quest beside the board and refuses it elsewhere', () => {
    const state = aggregates();
    const refused = executePlayerCommand(state, command('QUEST_ACCEPT', 0), ctx(false));
    expect(refused).toMatchObject({ ok: false, code: 'NOT_AT_BOARD' });
    const accepted = executePlayerCommand(state, command('QUEST_ACCEPT', 0), ctx(true));
    expect(accepted.ok && accepted.changed.progress?.quests.active).toEqual([
      { questId: 'woodcutter', progress: 0, state: 'active' },
    ]);
  });

  it('refuses a stale inventory revision', () => {
    const outcome = executePlayerCommand(aggregates(), command('QUEST_ACCEPT', 7), ctx(true));
    expect(outcome).toMatchObject({ ok: false, code: 'INVENTORY_STALE' });
  });

  it('pays the reward at the board and records the completion', () => {
    const state = aggregates();
    state.progress.quests.active.push({ questId: 'woodcutter', progress: 10, state: 'ready' });
    const outcome = executePlayerCommand(state, command('QUEST_CLAIM', 0), ctx(true));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.changed.progress?.quests).toEqual({ active: [], done: { woodcutter: 1 } });
    const axes = outcome.changed.inventory?.bag.filter((cell) => cell?.key === HEXOBJECT_KEYS.AXE);
    expect(axes?.reduce((sum, cell) => sum + (cell?.amount ?? 0), 0)).toBe(5);
  });
});
