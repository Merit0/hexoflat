import { describe, expect, it } from 'vitest';
import { BATTLE_RULES } from './battle-content';
import { battleWith, giveTurn, hero, skeleton, strikeOpened } from './battle-test-setup';
import { projectBattleEvent, projectBattleForViewer } from './projection';
import { nextEnemyAction } from './ai/enemy-ai';

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
