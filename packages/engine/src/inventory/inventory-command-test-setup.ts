import { applyCommand, type HexEngineState } from '../commands/apply-command';
import type { HexEngineCommand } from '../commands/hex-engine-commands';
import { createContext } from '../commands/command-test-context';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { type THexobjectKey } from '../registry/hexobjects-registry';
import { emptyInventoryState, mintItem, type InventoryState } from './inventory-state';

export const HERO = 'h1';
export const bag = (index: number) => ({ container: 'bag' as const, index });
export const stash = (index: number) => ({ container: 'stash' as const, index });
export const hand = (slot: 'weapon' | 'shield') => ({ container: 'equip' as const, slot });

export function give(
  state: InventoryState,
  where: { container: string; index?: number; slot?: string },
  key: THexobjectKey,
  amount = 1,
) {
  const item = mintItem(state, key, amount);
  if (where.container === 'bag') state.bag[where.index!] = item;
  else if (where.container === 'stash') state.stash.cells[where.index!] = item;
  else state.equip[where.slot as 'weapon'] = item;
  return item;
}

export function world(
  inventory: InventoryState,
  inventoryContext = { stashOpen: true, battleOpen: false },
): HexEngineState {
  const map = new HexMapBuilder().name('inv').width(2).height(2).build();
  return { map, heroes: {}, inventory, inventoryContext };
}

export function run(state: HexEngineState, command: HexEngineCommand) {
  return applyCommand(state, command, createContext());
}

export function move(revision: number, from: object, to: object, split = false): HexEngineCommand {
  return {
    type: 'MOVE_ITEM',
    payload: { heroId: HERO, revision, from, to, split },
  } as HexEngineCommand;
}

export function everyItemId(state: InventoryState): string[] {
  return [...state.bag, ...Object.values(state.equip), ...state.stash.cells]
    .filter((cell) => cell !== null)
    .map((cell) => cell.id);
}

export function fresh(chests = 1) {
  const inv = emptyInventoryState(HERO);
  inv.stash.chests = chests;
  return inv;
}
