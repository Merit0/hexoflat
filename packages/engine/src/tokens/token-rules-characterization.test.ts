import { sampleToken } from './token-test-setup';
import { devTokenMint } from '../inventory/apply-stock';
import { describe, expect, it } from 'vitest';
import { executePlayerCommand, type PlayerAggregates } from '../aggregates/execute-player-command';
import { PLAYER_COMMAND_SCHEMAS } from '../aggregates/player-commands';
import { emptyProgressState } from '../aggregates/progress-state';
import type { BattleCreature } from '../battle/battle-state';
import { applyCommand } from '../commands/apply-command';
import { createContext, toState } from '../commands/command-test-context';
import { EHexActionType } from '../enums/hex-action-type';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { grantToDraft, type IInventoryDraft } from '../inventory/apply-stock';
import { emptyInventoryState } from '../inventory/inventory-state';
import { pickupStack } from '../loot/pickup-stack';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { BOARD_QUESTS, questContentFailures, questSellValue } from '../quests/quests.content';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { planBuy } from '../trade/plan-buy';
import { planList } from '../trade/plan-listing';
import { planSell } from '../trade/plan-sell';
import { emptyListings } from '../trade/listing-state';
import { HERO, inventoryWith, traderWith } from '../trade/trade-test-setup';
import { syncHandsToInventory } from '../world/battle-hands-sync';

const { SWORD, SHIELD, AXE, PICKAXE, HAND, COINS, TREE } = HEXOBJECT_KEYS;

function draftOf(): IInventoryDraft {
  return { current: emptyInventoryState(HERO), events: [] };
}

function startAction(objectKey: THexobjectKey, actionType: EHexActionType, toolKey: string) {
  const map = new HexMapBuilder().name('tools').width(2).height(1).build();
  const tile = map.tiles[0];
  tile.hexobject = HexObjectFactory.create(objectKey, tile.coordinates);
  const result = applyCommand(
    toState(map),
    {
      type: 'START_HEX_ACTION',
      payload: { heroId: HERO, coordinates: tile.coordinates, actionType, toolKey, now: 0 },
    } as never,
    createContext(),
  );
  return result.events[0];
}

function creatureWith(right: string | null): BattleCreature {
  return { hands: { right: right ? { key: right } : null, left: null } } as BattleCreature;
}

describe('LG5b characterization: items enter the bag', () => {
  it('grantToDraft puts one sword per bag cell', () => {
    const draft = draftOf();
    expect(grantToDraft(draft, SWORD, 2, 'pickup', { mint: devTokenMint(draft.current!) })).toBe(
      true,
    );
    const swords = draft.current!.bag.filter((cell) => cell?.key === SWORD);
    expect(swords.map((cell) => cell!.amount)).toEqual([1, 1]);
  });

  it('pickupStack takes the whole stack into the bag and leaves the rest on the ground', () => {
    const bag = draftOf();
    const stacks = [
      {
        itemKey: SHIELD,
        amount: 1,
        id: 'a',
        token: sampleToken({ type: SHIELD, name: { kind: 'noun', noun: SHIELD } }),
      },
      { itemKey: COINS, amount: 4, id: 'b' },
    ];
    const result = pickupStack({ stacks, isTarget: (s) => s.id === 'a', adjacent: true, bag });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.remaining.map((s) => s.id)).toEqual(['b']);
    expect(bag.current!.bag.some((cell) => cell?.key === SHIELD)).toBe(true);
  });
});

describe('LG5b characterization: set-hands', () => {
  it('moves the bag sword into the weapon hand with the same id', () => {
    const inventory = inventoryWith({ 0: [SWORD, 1] });
    const id = inventory.bag[0]!.id;
    const next = syncHandsToInventory(inventory, creatureWith(null), creatureWith('sword'));
    expect(next?.equip.weapon?.id).toBe(id);
    expect(next?.equip.weapon?.amount).toBe(1);
    expect(next?.bag[0]).toBeNull();
  });
});

describe('LG5b characterization: CUT and MINE tools', () => {
  it('an axe starts CUT on a tree', () => {
    expect(startAction(TREE, EHexActionType.CUT, AXE).type).toBe('HEX_ACTION_STARTED');
  });

  it('the bare hand and a sword cannot cut', () => {
    for (const tool of [HAND, SWORD, PICKAXE]) {
      expect(startAction(TREE, EHexActionType.CUT, tool).payload).toMatchObject({
        message: `Need a tool: ${AXE}`,
      });
    }
  });

  it('a pickaxe starts MINE on a rock, an axe and the hand do not', () => {
    expect(startAction(HEXOBJECT_KEYS.ROCK, EHexActionType.MINE, PICKAXE).type).toBe(
      'HEX_ACTION_STARTED',
    );
    for (const tool of [HAND, AXE]) {
      expect(startAction(HEXOBJECT_KEYS.ROCK, EHexActionType.MINE, tool).payload).toMatchObject({
        message: `Need a tool: ${PICKAXE}`,
      });
    }
  });
});

describe('LG5b characterization: hero max hearts', () => {
  it('an equipped shield cell raises the heart bonus by one', () => {
    const aggregates: PlayerAggregates = {
      inventory: emptyInventoryState(HERO),
      progress: emptyProgressState(HERO),
    };
    const inventory = inventoryWith({}, { shield: [SHIELD, 1] });
    const command = PLAYER_COMMAND_SCHEMAS.DEV_SET_INVENTORY.parse({
      type: 'DEV_SET_INVENTORY',
      payload: { heroId: HERO, revision: 0, inventory },
    });
    const outcome = executePlayerCommand(aggregates, command, {
      devGrantAllowed: true,
      inventory: { stashOpen: true, battleOpen: false },
    });
    if (!outcome.ok) throw new Error(outcome.code);
    expect(outcome.changed.progress?.health.bonus).toBe(1);
  });
});

describe('LG5b characterization: shop prices', () => {
  it('buys a sword for 500 and sells it for 200, buyback at the sale price', () => {
    const rich = inventoryWith({ 0: [COINS, 600] });
    const bought = planBuy(rich, traderWith([[SWORD, 1]]), { list: 'goods', index: 0 }, 'auto', {
      split: false,
      expectedPrice: 500,
    });
    expect(bought).toMatchObject({ ok: true, price: 500 });
    if (!bought.ok) return;
    const swordAt = bought.inventory.bag.findIndex((cell) => cell?.key === SWORD);
    const sold = planSell(bought.inventory, { key: 'ilva', state: bought.trader }, swordAt, {
      split: false,
      expectedPrice: 200,
    });
    expect(sold).toMatchObject({ ok: true, price: 200 });
    if (!sold.ok) return;
    expect(sold.trader.buyback[0]).toMatchObject({ key: SWORD, unitPrice: 200 });
  });

  it('lists a sword in an own slot and refuses coins', () => {
    const inventory = inventoryWith({ 0: [SWORD, 1], 1: [COINS, 5] });
    expect(planList(inventory, emptyListings(), 0, 77)).toMatchObject({ ok: true });
    expect(planList(inventory, emptyListings(), 1, 77)).toMatchObject({
      ok: false,
      reason: 'NOT_TRADEABLE',
    });
  });
});

describe('LG5b characterization: R-Q-12', () => {
  it('board quests pass the content check and the woodcutter reward sells for 120', () => {
    expect(questContentFailures(BOARD_QUESTS)).toEqual([]);
    const woodcutter = BOARD_QUESTS.find((quest) => quest.id === 'woodcutter')!;
    expect(questSellValue(woodcutter)).toBe(120);
  });
});
