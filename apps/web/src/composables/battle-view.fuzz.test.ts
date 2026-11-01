import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { BATTLE_HANDS } from '@hexoflat/engine/battle/battle-state';
import { BATTLE_RULES } from '@hexoflat/engine/battle/battle-content';
import { enemyCreature } from '@hexoflat/engine/battle/battle-catalogue';
import { hero, skeleton } from '@hexoflat/engine/battle/battle-test-setup';
import { hexNeighbours } from '@hexoflat/engine/battle/hex-battle-geom';
import { createSeededRandom } from '@hexoflat/engine/utils/random-seeded';
import { useBattleStore } from '@/stores/battle-store';
import { testDeploy } from '@/stores/battle-store.fixture';
import { battleTapActions } from './battle-board-tap';
import { buildBattleView } from './battle-view';
import type { BattleUiState } from './battle-view-types';

const NAMES: Record<string, string> = { hero: 'Merito' };

function view(ui: BattleUiState) {
  const store = useBattleStore();
  return buildBattleView({
    deploy: store.deploy,
    projection: store.projection,
    localHeroIds: store.localHeroIds,
    lastHeroEvents: store.lastHeroEvents,
    turnStartWill: store.turnStartWill,
    revealedShields: store.revealedShields,
    ui,
    rules: BATTLE_RULES,
    nameOf: (id) => NAMES[id] ?? id,
  });
}

function checkView(built: ReturnType<typeof view>, will: number): string[] {
  const problems: string[] = [];
  const card = built.hero;
  if (card) {
    if (!Number.isFinite(card.turnCost) || card.turnCost < 0)
      problems.push(`cost ${card.turnCost}`);
    if (card.costTooHigh !== card.turnCost > will)
      problems.push('costTooHigh disagrees with the cost');
    if (card.will < 0 || card.will > card.willCap + 40) problems.push(`will ${card.will}`);
    if (card.state === 'defend' && !card.defend) problems.push('defend card without defend');
    if (card.state === 'aim' && !card.aim) problems.push('aim card without aim');
  }
  const tool = built.board?.tool;
  if (tool && (tool.price < 0 || !Number.isFinite(tool.price)))
    problems.push(`tool price ${tool.price}`);
  for (const mark of built.board?.overlay.marks ?? []) {
    if (!Number.isInteger(mark.hex.q) || !Number.isInteger(mark.hex.r)) problems.push('bad mark');
  }
  return problems;
}

describe('battle view model under random play', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('builds every card, tool hex, overlay and cost without throwing or showing nonsense', () => {
    const problems: string[] = [];
    for (let n = 0; n < 60; n++) {
      setActivePinia(createPinia());
      const rng = createSeededRandom({ seed: `view-fuzz-${n}`, counter: 0 });
      const store = useBattleStore();
      store.prepare(
        testDeploy([
          hero({ q: 0, r: 0 }, { hp: 12, maxHp: 12 }),
          skeleton('s1', { q: 2, r: 0 }),
          enemyCreature('skeleton-king', 'k', { q: -2, r: 1 }),
          enemyCreature('skeleton-archer', 'a', { q: 0, r: -3 }),
        ]),
        ['hero'],
      );
      store.start();
      for (let step = 0; step < 160 && store.battle?.phase !== 'ended'; step++) {
        const projection = store.projection!;
        const me = projection.creatures.find((c) => c.id === 'hero')!;
        const around = hexNeighbours(me.pos);
        const ui: BattleUiState = {
          stage: rng() < 0.5 ? 'move' : 'action',
          mode: rng() < 0.5 ? 'move' : 'strike',
          hand: rng() < 0.2 ? null : BATTLE_HANDS[Math.floor(rng() * 2)],
          swapHand: 'left',
          hover: around[Math.floor(rng() * 6)],
          toolAt: rng() < 0.5 ? null : around[Math.floor(rng() * 6)],
        };
        ui.mode = ui.stage === 'action' ? 'strike' : 'move';
        try {
          const built = view(ui);
          problems.push(...checkView(built, projection.turnWill));
        } catch (error) {
          problems.push(`view threw at ${n}:${step}: ${(error as Error).message}`);
          break;
        }
        const actions = battleTapActions({
          projection: store.projection,
          localHeroIds: store.localHeroIds,
          mode: ui.mode,
          hex: around[Math.floor(rng() * 6)],
          rules: BATTLE_RULES,
        });
        if (actions.length) store.actAll(actions, step * 300);
        else if (store.needsEnemyTurn) store.runEnemyTurn(step * 300);
        else if (rng() < 0.3) store.act({ kind: 'end-turn' }, step * 300);
        else if (store.projection?.reaction) store.act({ kind: 'reaction-timeout' }, step * 300);
        store.setAnimating(false);
      }
    }
    expect(problems.slice(0, 8)).toEqual([]);
  });
});
