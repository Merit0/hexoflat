import { describe, expect, it } from 'vitest';
import { BATTLE_RULES } from './battle-content';
import { battleWith, giveTurn, hero, heroDoes, skeleton } from './battle-test-setup';
import { projectBattleEvent, projectBattleForViewer } from './projection';
import { nextPlaceholderAction } from './ai/placeholder-enemy';
import { beginTurn } from './turn';

function heroStruckSkeleton() {
  const battle = giveTurn(battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]), [
    'hero',
    's1',
  ]);
  return heroDoes(battle, { kind: 'strike', targetId: 's1', hand: 'right' });
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
    for (const state of [battle, twin]) {
      state.order = ['s1', 'hero'];
      state.turnIndex = 0;
      beginTurn(state, 's1', BATTLE_RULES);
    }
    const a = nextPlaceholderAction(projectBattleForViewer(battle, 'enemies'), BATTLE_RULES);
    const b = nextPlaceholderAction(projectBattleForViewer(twin, 'enemies'), BATTLE_RULES);
    expect(a).toEqual(b);
  });
});
