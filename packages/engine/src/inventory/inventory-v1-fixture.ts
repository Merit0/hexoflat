import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { emptyInventoryState, type InventoryState } from './inventory-state';

export const V1_HERO = 'hero-v1';

export function inventoryV1Fixture(heroId: string = V1_HERO): InventoryState {
  const state = emptyInventoryState(heroId);
  state.revision = 7;
  state.idSeq = 6;
  state.equip.weapon = {
    id: `${heroId}:0`,
    key: 'sword',
    type: EHexobjectGroup.EQUIPMENT,
    amount: 1,
  };
  state.equip.shield = {
    id: `${heroId}:1`,
    key: 'shield',
    type: EHexobjectGroup.EQUIPMENT,
    amount: 1,
  };
  state.bag[0] = { id: `${heroId}:2`, key: 'axe', type: EHexobjectGroup.TOOL, amount: 1 };
  state.bag[1] = {
    id: `${heroId}:3`,
    key: 'coins',
    type: EHexobjectGroup.LOOT,
    stackKey: 'coins',
    amount: 120,
  };
  state.bag[2] = {
    id: `${heroId}:4`,
    key: 'health-bottle',
    type: EHexobjectGroup.LOOT,
    stackKey: 'health-bottle',
    amount: 2,
  };
  state.stash.chests = 1;
  state.stash.cells[0] = {
    id: `${heroId}:5`,
    key: 'pickaxe',
    type: EHexobjectGroup.TOOL,
    amount: 1,
  };
  return state;
}
