import { describe, expect, it } from 'vitest';
import { nextActionCost } from './battle-next-cost';
import type { BattleBoardView } from './battle-view';

function board(patch: Partial<BattleBoardView>): BattleBoardView {
  return { tool: null, preview: null, ...patch } as BattleBoardView;
}

const walk = { path: [], cost: 6, reachable: true };
const tool = (action: 'attack' | null, price: number) =>
  ({ action, price }) as NonNullable<BattleBoardView['tool']>;

describe('nextActionCost', () => {
  it('takes the price of the whole walk while the hero is moving', () => {
    expect(nextActionCost(board({ preview: walk }), 'move')).toEqual({ source: 'move', cost: 6 });
  });

  it('takes the use price of the open tool, and ignores a leftover walk preview', () => {
    const open = board({ preview: walk, tool: tool('attack', 9) });
    expect(nextActionCost(open, 'action')).toEqual({ source: 'tool', cost: 9 });
  });

  it('shows nothing for a tool with no valid action, and nothing without a plan', () => {
    expect(nextActionCost(board({ tool: tool(null, 7) }), 'action')).toEqual({
      source: 'tool',
      cost: 0,
    });
    expect(nextActionCost(board({}), 'move')).toEqual({ source: null, cost: 0 });
    expect(nextActionCost(null, 'move')).toEqual({ source: null, cost: 0 });
  });
});
