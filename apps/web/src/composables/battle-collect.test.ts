import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { BATTLE_RULES } from '@hexoflat/engine/battle/battle-content';
import { COLLECT_REJECTION_CODES } from '@hexoflat/engine/battle/battle-rejection';
import { enemyCreature } from '@hexoflat/engine/battle/battle-catalogue';
import { applyDamage } from '@hexoflat/engine/battle/battle-end';
import type { BattleCreature, BattleState } from '@hexoflat/engine/battle/battle-state';
import { projectBattleForViewer, type BattleProjection } from '@hexoflat/engine/battle/projection';
import { startBattle } from '@hexoflat/engine/battle/start-battle';
import { TEST_TOKEN_SECRET } from '@hexoflat/engine/battle/battle-test-setup';
import { devBattleHero } from '@/a-game-scenes/battle-scene/dev-battlefield';
import enUi from '@/locales/en/ui.json';
import ukUi from '@/locales/uk/ui.json';
import { inventorySession } from '@/services/inventory/inventory-session';
import { needsGraveExitWarning } from '@/services/battle/grave-exit-warning';
import { buildBattleHexInfo } from '@/services/hex-info/build-battle-hex-info';
import { useBattleStore } from '@/stores/battle-store';
import { battleMovePreview, battleTapActions } from './battle-board-tap';
import { collectHero, collectRoute, collectToolTarget } from './battle-collect';
import { battleRejectKey } from './battle-hint';
import { buildBattleToolHex } from './battle-tool-hex';

function floor(): BattleState['board'] {
  const tiles: BattleState['board'] = {};
  for (let q = -3; q <= 3; q++) {
    for (let r = -3; r <= 3; r++) if (Math.abs(q + r) <= 3) tiles[`${q},${r}`] = 'floor';
  }
  return tiles;
}

function fight(): BattleState {
  const creatures: BattleCreature[] = [
    { ...devBattleHero('h'), pos: { q: 0, r: 0 } },
    enemyCreature('skeleton-warrior', 'w', { q: 1, r: 0 }),
  ];
  return startBattle(
    { id: 'b', seed: 's', board: floor(), creatures, tokenSecret: TEST_TOKEN_SECRET },
    BATTLE_RULES,
  ).battle;
}

function victory(): BattleState {
  const state = fight();
  const enemy = state.creatures.find((c) => c.id === 'w')!;
  applyDamage(state, enemy, enemy.hp);
  return state;
}

const view = (state: BattleState): BattleProjection => projectBattleForViewer(state, 'heroes');
const rules = BATTLE_RULES;
const ui = (hand: 'right' | 'left' | null = 'right', toolAt = null) => ({
  stage: 'action' as const,
  mode: 'strike' as const,
  hand,
  swapHand: 'left' as const,
  hover: null,
  toolAt,
});

describe('the collection phase on the client', () => {
  it('has a walking hero only after a victory that left graves', () => {
    expect(collectHero(view(victory()), ['h'])?.id).toBe('h');
    expect(collectHero(view(fight()), ['h'])).toBeNull();
    const defeat = fight();
    defeat.phase = 'ended';
    defeat.outcome = 'defeat';
    expect(collectHero(view(defeat), ['h'])).toBeNull();
  });

  it('walks round graves with free steps and no price', () => {
    const projection = view(victory());
    const hero = collectHero(projection, ['h'])!;
    expect(collectRoute(projection, hero, { q: 1, r: 0 })).toEqual([]);
    const route = collectRoute(projection, hero, { q: 2, r: -1 });
    expect(route.length).toBeGreaterThan(1);
    expect(route.some((hex) => hex.q === 1 && hex.r === 0)).toBe(false);
    const tap = battleTapActions({
      projection,
      localHeroIds: ['h'],
      mode: 'move',
      hex: { q: 2, r: -1 },
      rules,
    });
    expect(tap.map((action) => action.kind)).toEqual(route.map(() => 'move'));
    const preview = battleMovePreview({
      projection,
      localHeroIds: ['h'],
      mode: 'move',
      hex: { q: 2, r: -1 },
      rules,
    });
    expect(preview).toMatchObject({ cost: 0, reachable: true });
  });

  it('offers the eye on a grave, examined or not, and take on a stack', () => {
    const state = victory();
    const projection = view(state);
    const hero = collectHero(projection, ['h'])!;
    expect(collectToolTarget(projection, hero, null)).toEqual({
      at: { q: 1, r: 0 },
      action: 'eye',
    });
    state.collect!.graves[0].examined = true;
    expect(collectToolTarget(view(state), hero, null)?.action).toBe('eye');
    state.collect!.items.push({ hex: { q: 0, r: 1 }, itemKey: 'coins', amount: 7 });
    const stacked = view(state);
    expect(collectToolTarget(stacked, hero, { q: 0, r: 1 })).toEqual({
      at: { q: 0, r: 1 },
      action: 'take',
    });
  });

  it('builds the hand tool hex with no price in the collection phase', () => {
    const tool = buildBattleToolHex({
      projection: view(victory()),
      localHeroIds: ['h'],
      ui: ui(),
      rules,
    });
    expect(tool).toMatchObject({ action: 'eye', price: 0, canAfford: true, toolKey: 'hand' });
  });

  it('offers no tool hex when nothing lies next to the hero', () => {
    const state = victory();
    state.collect!.graves = [];
    expect(
      buildBattleToolHex({ projection: view(state), localHeroIds: ['h'], ui: ui(), rules }),
    ).toBeNull();
  });

  it('shows the eye over a fallen enemy during the fight, to be refused on use', () => {
    const state = fight();
    const enemy = state.creatures.find((c) => c.id === 'w')!;
    enemy.hp = 0;
    state.phase = 'act';
    const tool = buildBattleToolHex({
      projection: view(state),
      localHeroIds: ['h'],
      ui: ui('right', { q: 1, r: 0 } as never),
      rules,
    });
    expect(tool?.action ?? 'eye').toBe('eye');
  });
});

describe('hover cards of the collection phase', () => {
  const t = (key: string) => key;
  const te = () => false;
  const scene = (state: BattleState) => ({
    board: state.board,
    boulders: [],
    creatures: state.creatures.filter((c) => c.id !== 'h'),
    collect: view(state).collect,
  });

  const texts = (card: { title: string; description: string | null; note: string | null }) =>
    [card.title, card.description, card.note].join(' ');

  it('shows the grave with a sentence and no digits, and the stamp once examined', () => {
    const state = victory();
    const fresh = buildBattleHexInfo({ q: 1, r: 0 }, scene(state), t, te)!;
    expect(fresh.empty).toBe(false);
    expect(fresh.note).toBe('hexInfo.hints.graveLoot');
    expect(texts(fresh)).not.toMatch(/\d/);
    state.collect!.graves[0].examined = true;
    const done = buildBattleHexInfo({ q: 1, r: 0 }, scene(state), t, te)!;
    expect(done.empty).toBe(true);
    expect(texts(done)).not.toMatch(/\d/);
  });

  it('shows a ground stack with its quantity', () => {
    const state = victory();
    state.collect!.items.push({ hex: { q: 0, r: 1 }, itemKey: 'coins', amount: 7 });
    const card = buildBattleHexInfo({ q: 0, r: 1 }, scene(state), t, te)!;
    expect(card.stats.find((stat) => stat.id === 'amount')?.value).toBe('7');
  });

  it('shows nothing over a living hero standing on a grave', () => {
    const state = victory();
    const hero = state.creatures.find((c) => c.id === 'h')!;
    hero.pos = { q: 1, r: 0 };
    const live = { ...scene(state), creatures: state.creatures };
    expect(buildBattleHexInfo({ q: 1, r: 0 }, live, t, te)).toBeNull();
  });
});

describe('refusal texts', () => {
  it('has uk and en text for every collect rejection and the fight refusal', () => {
    for (const code of [...COLLECT_REJECTION_CODES, 'FIGHT_NOT_OVER']) {
      for (const ui of [enUi, ukUi]) {
        const key = battleRejectKey(code);
        const text = key
          .split('.')
          .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], ui);
        expect(text, code).toBeTruthy();
      }
    }
    expect(ukUi.battle.reject.CONTAINER_EMPTY).toBe('Нічого не знайдено!');
    expect(ukUi.battle.reject.FIGHT_NOT_OVER).toBe('Спершу переможи.');
  });
});

describe('the one-time exit warning', () => {
  beforeEach(() => {
    inventorySession.graveExitWarningAcknowledged = false;
  });

  it('shows with loot left and no milestone', () => {
    expect(needsGraveExitWarning(view(victory()))).toBe(true);
  });

  it('does not show after the acknowledgement or with nothing left', () => {
    inventorySession.graveExitWarningAcknowledged = true;
    expect(needsGraveExitWarning(view(victory()))).toBe(false);
    inventorySession.graveExitWarningAcknowledged = false;
    const state = victory();
    state.collect!.graves[0].examined = true;
    expect(needsGraveExitWarning(view(state))).toBe(false);
  });
});

describe('the store in the collection phase', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('sends a collect action for the walking hero although a dead enemy was last active', async () => {
    const store = useBattleStore();
    const request = vi.fn(() =>
      Promise.resolve({
        ok: true,
        code: null,
        steps: [],
        events: [],
        closed: false,
        result: null,
      }),
    );
    store.bindBridge({
      request,
      onStep: () => {},
      closed: () => Promise.resolve(),
      restore: () => Promise.resolve(null),
    });
    const state = victory();
    state.activeId = 'w';
    store.localHeroIds = ['h'];
    store.projection = view(state);
    await store.act({ kind: 'loot-grave', hex: { q: 1, r: 0 } });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('keeps the board open after a victory with graves (the stage stays ended, not closed)', () => {
    const projection = view(victory());
    expect(projection.phase).toBe('ended');
    expect(projection.collect?.graves).toHaveLength(1);
    expect(projection.lootLeft).toBe(true);
  });
});
