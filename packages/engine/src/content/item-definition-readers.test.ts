import { describe, expect, it } from 'vitest';
import { EHexobjectGroup, ETokenType } from '../abstraction/hexobject-abstraction';
import type { InventoryItem } from '../abstraction/inventory-abstraction';
import { createContext } from '../commands/command-test-context';
import { EHexActionType } from '../enums/hex-action-type';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { resolveActions } from '../game-resolvers/interactions-resolver';
import { inventoryLightNameOf } from '../inventory/item-queries';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { ACTION_STARTERS } from '../registry/action-starters-registry';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { sampleToken } from '../tokens/token-test-setup';
import { resolveEquipCompatibility } from '../utils/inventory/equip-compatibility';
import { resolveItemTooltip } from '../utils/inventory/item-tooltip';
import { resolveInventoryView } from '../utils/inventory/traits-resolver';
import type { THeroToolKey } from './equipment.content';

const { SWORD, SHIELD, AXE, PICKAXE, HAND, TREE, ROCK } = HEXOBJECT_KEYS;
const GEAR = [SWORD, SHIELD, AXE, PICKAXE] as const;

function itemOf(key: THexobjectKey, type: EHexobjectGroup): InventoryItem {
  return { id: `i-${key}`, key, type, amount: 1 } as InventoryItem;
}

const ITEMS: Record<(typeof GEAR)[number] | typeof HAND, InventoryItem> = {
  [SWORD]: itemOf(SWORD, EHexobjectGroup.EQUIPMENT),
  [SHIELD]: itemOf(SHIELD, EHexobjectGroup.EQUIPMENT),
  [AXE]: itemOf(AXE, EHexobjectGroup.TOOL),
  [PICKAXE]: itemOf(PICKAXE, EHexobjectGroup.TOOL),
  [HAND]: itemOf(HAND, EHexobjectGroup.TOOL),
};

function tileWith(objectKey: THexobjectKey) {
  const map = new HexMapBuilder().name('readers').width(1).height(1).build();
  const tile = map.tiles[0];
  tile.hexobject = HexObjectFactory.create(objectKey, tile.coordinates);
  return tile;
}

function start(action: EHexActionType, objectKey: THexobjectKey, tool: THeroToolKey) {
  const ctx = createContext();
  const tile = tileWith(objectKey);
  const result = ACTION_STARTERS[action](tile, tool, 0, {
    ...ctx,
    map: new HexMapBuilder().name('context').width(1).height(1).build(),
    now: 0,
    inventory: { current: undefined, events: [] },
  });
  return { result, ctx };
}

describe('LG5d characterization: equip slot readers', () => {
  it.each([
    [SWORD, 'effect', 'mismatch'],
    [SHIELD, 'mismatch', 'effect'],
    [AXE, 'effect', 'effect'],
    [PICKAXE, 'effect', 'effect'],
    [HAND, 'effect', 'effect'],
  ] as const)('%s fits the weapon hand: %s, the shield hand: %s', (key, weapon, shield) => {
    expect(resolveEquipCompatibility(ITEMS[key], 'weapon')).toBe(weapon);
    expect(resolveEquipCompatibility(ITEMS[key], 'shield')).toBe(shield);
  });

  it.each([...GEAR, HAND])('%s never fits a body slot', (key) => {
    for (const slot of ['helm', 'armor', 'gloves', 'boots', 'ring', 'amulet'] as const) {
      expect(resolveEquipCompatibility(ITEMS[key], slot)).toBe('mismatch');
    }
  });

  it.each([
    [SWORD, 'weapon'],
    [SHIELD, 'shield'],
    [AXE, undefined],
    [PICKAXE, undefined],
    [HAND, undefined],
  ] as const)('%s shows the equip slot %s in the inventory view and the tooltip', (key, slot) => {
    expect(resolveInventoryView(key).equipSlot).toBe(slot);
    expect(resolveItemTooltip(key).equipSlot).toBe(slot);
  });
});

describe('LG5d characterization: strike readers', () => {
  it('shows the sword damage as one heart, min equal to max', () => {
    expect(resolveItemTooltip(SWORD).headline).toEqual({ kind: 'damage', min: 1, max: 1 });
  });

  it('shows no damage headline for the shield, the axe and the pickaxe', () => {
    expect(resolveItemTooltip(SHIELD).headline?.kind).toBe('defense');
    expect(resolveItemTooltip(AXE).headline?.kind).toBe('multiplier');
    expect(resolveItemTooltip(PICKAXE).headline?.kind).toBe('multiplier');
  });
});

describe('LG5d characterization: cut and mine readers', () => {
  it.each([
    [SWORD, ['attack']],
    [SHIELD, ['block']],
    [AXE, ['cut', 'attack']],
    [PICKAXE, ['mine', 'attack']],
    [HAND, ['pickup', 'enter', 'use', 'open', 'attack', 'block']],
  ] as const)('%s lists the capabilities %j in the tooltip', (key, capabilities) => {
    expect(resolveItemTooltip(key).capabilities).toEqual(capabilities);
  });

  it.each([
    [AXE, TREE, ['CUT']],
    [AXE, ROCK, []],
    [PICKAXE, ROCK, ['MINE']],
    [PICKAXE, TREE, []],
    [SWORD, TREE, []],
    [HAND, TREE, []],
    [HAND, ROCK, []],
  ] as const)('%s on %s offers %j', (tool, target, actions) => {
    const object = HexObjectFactory.create(target, { columnIndex: 0, rowIndex: 0 });
    expect(resolveActions(tool, object).map((action) => action.actioType)).toEqual(actions);
  });

  it.each([
    [EHexActionType.CUT, TREE, AXE, null],
    [EHexActionType.CUT, TREE, PICKAXE, 'Need a tool: axe'],
    [EHexActionType.CUT, TREE, SWORD, 'Need a tool: axe'],
    [EHexActionType.CUT, TREE, HAND, 'Need a tool: axe'],
    [EHexActionType.MINE, ROCK, PICKAXE, null],
    [EHexActionType.MINE, ROCK, AXE, 'Need a tool: pickaxe'],
    [EHexActionType.MINE, ROCK, HAND, 'Need a tool: pickaxe'],
  ] as const)('%s %s with %s refuses with %s', (action, target, tool, message) => {
    const { result } = start(action, target, tool);
    if (message === null) expect(result.ok).toBe(true);
    else expect(result).toEqual({ ok: false, message });
  });

  it.each([
    [EHexActionType.CUT, TREE, AXE],
    [EHexActionType.MINE, ROCK, PICKAXE],
    [EHexActionType.MINE, HEXOBJECT_KEYS.MOUNTAIN, PICKAXE],
  ] as const)('%s %s with %s wears the tool by 0.1', (action, target, tool) => {
    const { ctx } = start(action, target, tool);
    expect(ctx.heroToolStore.consumeDurability).toHaveBeenCalledWith(0.1);
  });
});

describe('LG5d characterization: tokenType readers', () => {
  it.each(GEAR)('%s without a token is an idol item', (key) => {
    expect(resolveItemTooltip(key).tokenType).toEqual({ kind: ETokenType.IDOL, boss: false });
    expect(resolveItemTooltip(key).lightName).toBe('idol');
    expect(inventoryLightNameOf(ITEMS[key])).toBe('idol');
  });
});

describe('LG5d: tokenType comes from the token', () => {
  it('sorts a gloom sword token as gloom and a unique as a boss tone', () => {
    const gloom = { ...ITEMS[SWORD], token: sampleToken({ tokenType: ETokenType.GLOOM }) };
    expect(inventoryLightNameOf(gloom as InventoryItem)).toBe('gloom');
    const unique = {
      ...ITEMS[SWORD],
      token: sampleToken({ tier: 'unique', tokenType: ETokenType.ALIEN }),
    };
    expect(inventoryLightNameOf(unique as InventoryItem)).toBe('alien');
  });
});
