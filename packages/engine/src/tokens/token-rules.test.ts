import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { executePlayerCommand, type PlayerAggregates } from '../aggregates/execute-player-command';
import { PLAYER_COMMAND_SCHEMAS } from '../aggregates/player-commands';
import { emptyProgressState } from '../aggregates/progress-state';
import type { BattleCreature } from '../battle/battle-state';
import { freeNeighbour, putObject, runOf } from '../chests/chest-test-setup';
import { cellHeartPoints } from '../combat/heart-points';
import { EHexActionType } from '../enums/hex-action-type';
import { emptyInventoryState, type InventoryState } from '../inventory/inventory-state';
import { pickupStack } from '../loot/pickup-stack';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { planBuy } from '../trade/plan-buy';
import { planList } from '../trade/plan-listing';
import { planSell } from '../trade/plan-sell';
import { priceOf, sellPriceOf } from '../trade/price-of';
import { emptyListings } from '../trade/listing-state';
import { HERO, inventoryWith, traderWith } from '../trade/trade-test-setup';
import { TRADERS } from '../content/traders.content';
import { actWorld, createServerWorld, tickWorld } from '../world';
import { syncHandsToInventory } from '../world/battle-hands-sync';
import { gameTokenFactory } from './game-tokens';
import { sampleToken } from './token-test-setup';
import { toolActionOf } from './tool-action';
import type { ItemToken } from './token-schema';

const { SWORD, SHIELD, AXE, PICKAXE, HAND, COINS } = HEXOBJECT_KEYS;
const CTX = { devGrantAllowed: true, inventory: { stashOpen: true, battleOpen: false } };

function swordToken(price = 120): ItemToken {
  return sampleToken({ id: 'test:sword.1:0', price });
}

function shieldToken(hearts: number): ItemToken {
  return sampleToken({
    id: 'test:shield.1:0',
    type: SHIELD,
    name: { kind: 'noun', noun: SHIELD },
    attributes: hearts > 0 ? [{ key: 'heart', value: hearts }] : [],
    sprite: 'idol-shield-01',
  });
}

function withBagToken(token: ItemToken, index = 0): InventoryState {
  const inventory = emptyInventoryState(HERO);
  inventory.bag[index] = {
    id: `${HERO}:0`,
    key: token.type as never,
    type: 'equipment' as never,
    amount: 1,
    token,
  };
  inventory.idSeq = 1;
  return inventory;
}

function aggregatesWith(inventory: InventoryState): PlayerAggregates {
  return { inventory, progress: emptyProgressState(HERO) };
}

function heldOf(inventory: InventoryState) {
  return [...inventory.bag, ...Object.values(inventory.equip)].filter((cell) => cell !== null);
}

describe('LG5b step 5: moving an item keeps its token', () => {
  it('pickupStack keeps the ground token: amount 1, same token', () => {
    const token = swordToken();
    const bag = { current: emptyInventoryState(HERO), events: [] };
    const result = pickupStack({
      stacks: [{ itemKey: SWORD, amount: 1, token }],
      isTarget: () => true,
      adjacent: true,
      bag,
    });
    expect(result.ok).toBe(true);
    const [cell] = heldOf(bag.current);
    expect(cell).toMatchObject({ key: SWORD, amount: 1, token });
  });

  it('TAKE keeps the token of the map object, and gives a tokenless one a token of the map', () => {
    const world = createServerWorld('camping', 'map-take', 'take-seed', HERO);
    const token = swordToken();
    const withToken = freeNeighbour(world, world.heroCoordinates!);
    const plain = freeNeighbour(world, world.heroCoordinates!, 1);
    putObject(world, withToken, SWORD, { token });
    putObject(world, plain, SWORD);
    let inventory = emptyInventoryState(HERO);
    let progress = emptyProgressState(HERO);
    for (const spot of [withToken, plain]) {
      const started = actWorld(runOf(world, { inventory, progress }), {
        heroId: HERO,
        coordinates: spot,
        actionType: EHexActionType.TAKE,
        toolKey: HAND,
        now: 1_000,
      });
      if (!started.ok) throw new Error(started.code);
      const done = tickWorld({
        ...runOf(started.world, { now: 60_000 }),
        inventory: started.inventory,
        progress: started.progress,
      });
      if (!done.ok) throw new Error(done.code);
      inventory = done.inventory;
      progress = done.progress;
    }
    const swords = heldOf(inventory);
    expect(swords[0].token).toEqual(token);
    expect(swords[1].token).toMatchObject({ type: SWORD, rarity: ERarityKind.IDOL });
    expect(swords[1].token!.id).not.toBe(token.id);
  });

  it('MOVE_ITEM into the hand keeps the id and the token', () => {
    const token = swordToken();
    const inventory = withBagToken(token);
    const outcome = executePlayerCommand(
      aggregatesWith(inventory),
      PLAYER_COMMAND_SCHEMAS.MOVE_ITEM.parse({
        type: 'MOVE_ITEM',
        payload: {
          heroId: HERO,
          revision: 0,
          from: { container: 'bag', index: 0 },
          to: { container: 'equip', slot: 'weapon' },
        },
      }),
      CTX,
    );
    if (!outcome.ok) throw new Error(outcome.code);
    expect(outcome.changed.inventory!.equip.weapon).toMatchObject({
      id: `${HERO}:0`,
      amount: 1,
      token,
    });
  });

  it('set-hands keeps the id and the token', () => {
    const token = swordToken();
    const creature = (right: string | null) =>
      ({ hands: { right: right ? { key: right } : null, left: null } }) as BattleCreature;
    const next = syncHandsToInventory(withBagToken(token), creature(null), creature(SWORD));
    expect(next?.equip.weapon).toMatchObject({ id: `${HERO}:0`, amount: 1, token });
  });
});

describe('LG5b step 6: heart attributes of equipped tokens (D8)', () => {
  it('counts half-hearts without rounding down', () => {
    expect(cellHeartPoints({ key: SHIELD, token: shieldToken(1) })).toBe(0.5);
    expect(cellHeartPoints({ key: SHIELD, token: shieldToken(3) })).toBe(1.5);
    expect(cellHeartPoints({ key: SHIELD, token: shieldToken(0) })).toBe(0);
    expect(cellHeartPoints({ key: SHIELD })).toBe(1);
  });

  it('a shield token with one half-heart raises the hero maximum by half a heart', () => {
    const inventory = emptyInventoryState(HERO);
    inventory.equip.shield = {
      id: `${HERO}:0`,
      key: SHIELD,
      type: 'equipment' as never,
      amount: 1,
      token: shieldToken(1),
    };
    inventory.idSeq = 1;
    const outcome = executePlayerCommand(
      aggregatesWith(emptyInventoryState(HERO)),
      PLAYER_COMMAND_SCHEMAS.DEV_SET_INVENTORY.parse({
        type: 'DEV_SET_INVENTORY',
        payload: { heroId: HERO, revision: 0, inventory },
      }),
      CTX,
    );
    if (!outcome.ok) throw new Error(outcome.code);
    expect(outcome.changed.progress?.health).toMatchObject({ bonus: 0.5, current: 3.5 });
  });
});

describe('LG5b step 7: tools act by type.tool.action (D3)', () => {
  it('reads the tool action from the item type', () => {
    expect(toolActionOf(AXE)).toBe(EHexActionType.CUT);
    expect(toolActionOf(PICKAXE)).toBe(EHexActionType.MINE);
    expect(toolActionOf(SWORD)).toBeNull();
    expect(toolActionOf(HAND)).toBeNull();
    expect(toolActionOf(null)).toBeNull();
  });
});

describe('LG5b step 8: priceOf reads the token price (D4)', () => {
  it('takes the token price for a token and the coin price for a stack', () => {
    expect(priceOf({ key: SWORD, token: swordToken(120) })).toBe(120);
    expect(priceOf({ key: SWORD })).toBe(500);
    expect(priceOf({ key: HEXOBJECT_KEYS.HAND })).toBeNull();
    expect(sellPriceOf(TRADERS.ilva, { key: SWORD, token: swordToken(120) })).toBe(48);
    expect(sellPriceOf(TRADERS.ilva, { key: COINS })).toBeNull();
  });

  it('sells a token for its own price, buys it back for the same, and keeps the token', () => {
    const token = swordToken(120);
    const sold = planSell(withBagToken(token), traderWith([]), 0, {
      split: false,
      expectedPrice: 48,
    });
    if (!sold.ok) throw new Error(sold.reason);
    expect(sold.trader.buyback[0]).toMatchObject({ key: SWORD, unitPrice: 48, token });
    const back = planBuy(
      sold.inventory,
      { key: 'ilva', state: sold.trader },
      { list: 'buyback', index: 0 },
      'auto',
      {
        split: false,
        expectedPrice: 48,
      },
    );
    if (!back.ok) throw new Error(back.reason);
    expect(heldOf(back.inventory).find((cell) => cell.key === SWORD)?.token).toEqual(token);
  });

  it('buys a goods token for its own price, always above the sale price', () => {
    const token = swordToken(120);
    const trader = traderWith([[SWORD, 1]]);
    trader.state.goods[0] = { key: SWORD, amount: 1, token };
    const bought = planBuy(
      inventoryWith({ 0: [COINS, 200] }),
      trader,
      { list: 'goods', index: 0 },
      'auto',
      {
        split: false,
        expectedPrice: 120,
      },
    );
    if (!bought.ok) throw new Error(bought.reason);
    expect(bought.price).toBe(120);
    expect(sellPriceOf(TRADERS.ilva, { key: SWORD, token })!).toBeLessThan(bought.price);
  });

  it('lists a token in an own slot and keeps it there', () => {
    const token = swordToken(120);
    const listed = planList(withBagToken(token), emptyListings(), 0, 99);
    if (!listed.ok) throw new Error(listed.reason);
    expect(listed.listings.find((slot) => slot !== null)).toMatchObject({ key: SWORD, token });
  });
});

describe('LG5b step 9: item skills are not wired', () => {
  it('equipping a token with skills changes no hero skill', () => {
    const made = gameTokenFactory().createUnique('last-verdict', {
      seed: 's',
      sourceId: 'test:unique',
      n: 0,
      mapTier: 1,
      ownedUniques: [],
    });
    if (!made.ok) throw new Error(made.refusal.code);
    expect(made.value.skills.length).toBeGreaterThan(0);
    const inventory = emptyInventoryState(HERO);
    inventory.equip.weapon = {
      id: `${HERO}:0`,
      key: SWORD,
      type: 'equipment' as never,
      amount: 1,
      token: made.value,
    };
    inventory.idSeq = 1;
    const before = emptyProgressState(HERO);
    const outcome = executePlayerCommand(
      { inventory: emptyInventoryState(HERO), progress: before },
      PLAYER_COMMAND_SCHEMAS.DEV_SET_INVENTORY.parse({
        type: 'DEV_SET_INVENTORY',
        payload: { heroId: HERO, revision: 0, inventory },
      }),
      CTX,
    );
    if (!outcome.ok) throw new Error(outcome.code);
    const after = outcome.changed.progress ?? before;
    expect(after.knowledge.skillProgress).toEqual(before.knowledge.skillProgress);
    expect(after.knowledge).toEqual(before.knowledge);
  });
});
