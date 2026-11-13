import { expect } from 'vitest';
import type { DomainEvent } from '../commands/types';
import type { IInventoryDraft } from '../inventory/apply-stock';
import { emptyInventoryState, type InventoryState } from '../inventory/inventory-state';
import { applyBattleCommand } from './apply-battle';
import { enemyCreature } from './battle-catalogue';
import { applyDamage } from './battle-end';
import { BATTLE_RULES } from './battle-content';
import { creatureById } from './battle-board';
import type { BattleAction } from './battle-commands';
import type { BattleCreature, BattleHex, BattleState, BattleTerrain } from './battle-state';
import { hexagonBoard, hero } from './battle-test-setup';
import { startBattle } from './start-battle';

export const ON = { ...BATTLE_RULES, graveLootEnabled: true };
export const ORIGIN = { q: 0, r: 0 };
export const TARGET = { q: 1, r: 0 };

export const RING_OF_TARGET: Record<string, BattleTerrain> = {
  '2,0': 'wall',
  '2,-1': 'wall',
  '1,-1': 'wall',
  '0,1': 'wall',
  '1,1': 'wall',
};

export function warrior(id: string, pos: BattleHex): BattleCreature {
  return enemyCreature('skeleton-warrior', id, pos);
}

export function king(id: string, pos: BattleHex): BattleCreature {
  return enemyCreature('skeleton-king', id, pos);
}

export function fight(
  enemies: BattleCreature[],
  options: {
    seed?: string;
    id?: string;
    board?: Record<string, BattleTerrain>;
    heroAt?: BattleHex;
  } = {},
): BattleState {
  return startBattle(
    {
      id: options.id ?? 'b1',
      seed: options.seed ?? 'loot-seed',
      board: options.board ?? hexagonBoard(),
      creatures: [hero(options.heroAt ?? ORIGIN), ...enemies],
    },
    ON,
  ).battle;
}

export function slay(state: BattleState, ...ids: string[]): void {
  for (const id of ids) {
    const creature = creatureById(state, id)!;
    applyDamage(state, creature, creature.hp);
  }
}

export function won(
  enemies: BattleCreature[],
  options: Parameters<typeof fight>[1] = {},
): BattleState {
  const state = fight(enemies, options);
  slay(state, ...enemies.map((enemy) => enemy.id));
  return state;
}

export interface Played {
  battle: BattleState;
  events: DomainEvent[];
  inventory: InventoryState | undefined;
  refused: string | null;
}

export function play(
  state: BattleState,
  action: BattleAction,
  inventory = emptyInventoryState('hero'),
): Played {
  const draft: IInventoryDraft = { current: inventory, events: [] };
  const result = applyBattleCommand(
    state,
    { type: 'BATTLE', payload: { kind: 'hero', heroId: 'hero', atMs: 0, action } },
    ON,
    { inventory: draft },
  );
  const refusal = result.events.find((event) => event.type === 'BATTLE_REJECTED');
  return {
    battle: result.battle!,
    events: [...result.events, ...draft.events],
    inventory: draft.current,
    refused: refusal ? String((refusal.payload as { rejected: string }).rejected) : null,
  };
}

export const lootAt = (hex: BattleHex): BattleAction => ({ kind: 'loot-grave', hex });
export const pickAt = (hex: BattleHex): BattleAction => ({ kind: 'pickup-loot', hex });
export const stepTo = (hex: BattleHex): BattleAction => ({ kind: 'move', hex });

export function expectRefused(
  state: BattleState,
  action: BattleAction,
  code: string,
  inventory = emptyInventoryState('hero'),
): void {
  const before = JSON.stringify(state);
  const bag = JSON.stringify(inventory);
  const result = play(state, action, inventory);
  expect(result.refused).toBe(code);
  expect(JSON.stringify(result.battle)).toBe(before);
  expect(JSON.stringify(result.inventory)).toBe(bag);
  expect(result.events.filter((event) => event.type.startsWith('ITEM_'))).toEqual([]);
  expect(creatureById(result.battle, 'hero')!.pos).toEqual(creatureById(state, 'hero')!.pos);
}
