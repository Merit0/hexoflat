import { describe, expect, it } from 'vitest';
import { BATTLE_RULES } from './battle-content';
import { battleWith, giveTurn, hero, skeleton, strikeOpened } from './battle-test-setup';
import { projectBattleEvent, projectBattleForViewer } from './projection';
import { nextEnemyAction } from './ai/enemy-ai';
import { issueTask } from './timed-task';

function heroStruckSkeleton() {
  const battle = giveTurn(battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]), [
    'hero',
    's1',
  ]);
  const opened = strikeOpened(battle, 'hero', 's1');
  const dealt = {
    type: 'STRIKE_DEALT',
    payload: { attackerId: 'hero', fromHex: opened.pending[0].fromHex },
  };
  return { battle: opened, events: [dealt] };
}

describe('REQ-BTL-013 projection hides the side of strikes', () => {
  it('shows the side only to the side that struck', () => {
    const { battle } = heroStruckSkeleton();
    expect(projectBattleForViewer(battle, 'enemies').pending[0].fromHex).toBeNull();
    expect(projectBattleForViewer(battle, 'heroes').pending[0].fromHex).toEqual({ q: 0, r: 0 });
    expect(projectBattleForViewer(battle, 'enemies').pending[0].ring).toHaveLength(6);
    expect('seed' in projectBattleForViewer(battle, 'heroes')).toBe(false);
  });

  it('strips the side from the strike event for the other side', () => {
    const { battle, events } = heroStruckSkeleton();
    const dealt = events.find((e) => e.type === 'STRIKE_DEALT')!;
    expect(
      (projectBattleEvent(battle, dealt, 'enemies').payload as { fromHex: unknown }).fromHex,
    ).toBeNull();
    expect(projectBattleEvent(battle, dealt, 'heroes')).toBe(dealt);
  });

  it('gives the enemy the same decisions whatever the hidden side is', () => {
    const { battle } = heroStruckSkeleton();
    const twin = structuredClone(battle);
    twin.pending[0].fromHex = { q: 1, r: -1 };
    const a = nextEnemyAction(projectBattleForViewer(battle, 'enemies'), BATTLE_RULES);
    const b = nextEnemyAction(projectBattleForViewer(twin, 'enemies'), BATTLE_RULES);
    expect(a).toEqual(b);
  });
});

describe('the projection keeps secrets of the server out of the client', () => {
  it('hides the answer of a task, the seed, the history, the wounds and the enemy bag', () => {
    const base = battleWith([
      hero({ q: 0, r: 0 }),
      skeleton('s1', { q: 1, r: 0 }, { bag: [{ key: 'health-potion', usePrice: 2, heal: 2 }] }),
    ]);
    const battle = {
      ...base,
      taskHistory: { saw: [true] },
      wounds: { hero: [{ q: 1, r: 0 }] },
      turnClockMs: 9,
    };
    issueTask(battle, 'saw', 'hero', 1000, BATTLE_RULES);
    battle.task!.answer = 4242;
    const seen = projectBattleForViewer(battle, 'heroes');
    const text = JSON.stringify(seen);
    expect(seen.task?.answer).toBe(0);
    expect(text).not.toContain('4242');
    expect(text).not.toContain(battle.seed);
    expect(seen).not.toHaveProperty('seed');
    expect(seen).not.toHaveProperty('taskHistory');
    expect(seen).not.toHaveProperty('wounds');
    expect(seen).not.toHaveProperty('turnClockMs');
    expect(seen.creatures.find((c) => c.id === 's1')!.bag).toEqual([]);
    expect(projectBattleForViewer(battle, 'enemies').creatures[0].bag).toEqual([]);
  });
});
