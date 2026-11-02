import type { BattleStage } from './battle-stage';
import type { BattleBoardView } from './battle-view';

export type NextCostSource = 'move' | 'tool' | null;

export interface NextCost {
  source: NextCostSource;
  cost: number;
}

export function nextActionCost(board: BattleBoardView | null, stage: BattleStage): NextCost {
  if (!board) return { source: null, cost: 0 };
  if (stage === 'action') {
    const tool = board.tool;
    return tool?.action ? { source: 'tool', cost: tool.price } : { source: 'tool', cost: 0 };
  }
  const route = board.preview;
  return route ? { source: 'move', cost: route.cost } : { source: null, cost: 0 };
}
