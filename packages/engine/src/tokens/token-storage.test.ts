import { describe, expect, it } from 'vitest';
import { executePlayerCommand, PLAYER_COMMAND_SCHEMAS, type PlayerCommand } from '../aggregates';
import { emptyProgressState } from '../aggregates/progress-state';
import { containerStateSchema } from '../containers/container';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { groundItemSchema } from '../battle/battle-state';
import { createServerWorld, deserializeWorld, serializeWorld } from '../world/server-world';
import { planBuy } from '../trade/plan-buy';
import { planList, planUnlist } from '../trade/plan-listing';
import { planSell } from '../trade/plan-sell';
import { buybackEntrySchema, traderGoodSchema } from '../trade/trade-state';
import { listingSchema, emptyListings } from '../trade/listing-state';
import { sellPriceOf } from '../trade/price-of';
import { HERO, ILVA, SWORD, inventoryWith, traderWith } from '../trade/trade-test-setup';
import { upcastToken } from '../inventory/upcast-item-tokens';
import type { InventoryState } from '../inventory/inventory-state';
import { createTokenFactory } from './factory/create-token-factory';
import type { ItemToken } from './token-schema';

function swordToken(): ItemToken {
  return upcastToken(HERO, 'bag.0', 'sword')!;
}

function heroWithTokenSword(): InventoryState {
  const inventory = inventoryWith({ 0: [SWORD, 1] });
  inventory.bag[0] = { ...inventory.bag[0]!, token: swordToken() };
  return inventory;
}

describe('a token keeps its data wherever the item goes (LG5a, D1)', () => {
  it('moves from the bag into a hand with the same token', () => {
    const inventory = heroWithTokenSword();
    const command = PLAYER_COMMAND_SCHEMAS.MOVE_ITEM.parse({
      type: 'MOVE_ITEM',
      payload: {
        heroId: HERO,
        revision: 0,
        from: { container: 'bag', index: 0 },
        to: { container: 'equip', slot: 'weapon' },
      },
    }) as PlayerCommand;
    const outcome = executePlayerCommand(
      { inventory, progress: emptyProgressState(HERO) },
      command,
      { devGrantAllowed: false, inventory: { stashOpen: false, battleOpen: false } },
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.changed.inventory!.equip.weapon!.token).toEqual(swordToken());
  });

  it('is sold into BUYBACK with its token and bought back as the same token', () => {
    const unit = sellPriceOf(ILVA, { key: SWORD, token: swordToken() })!;
    const sold = planSell(heroWithTokenSword(), traderWith([]), 0, {
      split: false,
      expectedPrice: unit,
    });
    if (!sold.ok) throw new Error(sold.reason);
    expect(sold.trader.buyback[0]!.token).toEqual(swordToken());
    expect(buybackEntrySchema.safeParse(sold.trader.buyback[0]).success).toBe(true);

    const back = planBuy(
      sold.inventory,
      { key: 'ilva', state: sold.trader },
      { list: 'buyback', index: 0 },
      'auto',
      { split: false, expectedPrice: unit },
    );
    if (!back.ok) throw new Error(back.reason);
    const swords = back.inventory.bag.filter((cell) => cell?.key === SWORD);
    expect(swords).toHaveLength(1);
    expect(swords[0]!.token).toEqual(swordToken());
  });

  it('never merges two token swords in BUYBACK', () => {
    const inventory = inventoryWith({ 0: [SWORD, 1], 1: [SWORD, 1] });
    inventory.bag[0] = { ...inventory.bag[0]!, token: swordToken() };
    inventory.bag[1] = { ...inventory.bag[1]!, token: upcastToken(HERO, 'bag.1', 'sword')! };
    const first = planSell(inventory, traderWith([]), 0, {
      split: false,
      expectedPrice: sellPriceOf(ILVA, inventory.bag[0])!,
    });
    if (!first.ok) throw new Error(first.reason);
    const second = planSell(first.inventory, { key: 'ilva', state: first.trader }, 1, {
      split: false,
      expectedPrice: sellPriceOf(ILVA, inventory.bag[1])!,
    });
    if (!second.ok) throw new Error(second.reason);
    expect(second.trader.buyback.filter(Boolean)).toHaveLength(2);
  });

  it('is listed in an own slot with its token and taken back as the same token', () => {
    const listed = planList(heroWithTokenSword(), emptyListings(), 0, 300);
    if (!listed.ok) throw new Error(listed.reason);
    expect(listed.listings[0]!.token).toEqual(swordToken());
    expect(listingSchema.safeParse(listed.listings[0]).success).toBe(true);
    const back = planUnlist(listed.inventory, listed.listings, 0);
    if (!back.ok) throw new Error(back.reason);
    expect(back.inventory.bag.find((cell) => cell?.key === SWORD)!.token).toEqual(swordToken());
  });

  it('stays on a map hexobject through a world save and load', () => {
    const world = createServerWorld('camping', 'map-t', 'seed-t', HERO);
    const tile = world.map.tiles.find((t) => !t.hexobject && t.terrain === 'ground')!;
    tile.hexobject = HexObjectFactory.create(SWORD, tile.coordinates, { token: swordToken() });
    const loaded = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(world))), 0);
    const again = loaded.map.tiles.find(
      (t) =>
        t.coordinates.columnIndex === tile.coordinates.columnIndex &&
        t.coordinates.rowIndex === tile.coordinates.rowIndex,
    )!;
    expect(again.hexobject?.token).toEqual(swordToken());
  });
});

describe('token entry schemas (LG0 B, K)', () => {
  const token = swordToken();

  it('accept a token on trader goods, buyback, listings, ground items and chest contents', () => {
    expect(traderGoodSchema.safeParse({ key: SWORD, amount: 1, token }).success).toBe(true);
    expect(
      buybackEntrySchema.safeParse({ key: SWORD, amount: 1, unitPrice: 200, token }).success,
    ).toBe(true);
    expect(listingSchema.safeParse({ key: SWORD, amount: 1, unitPrice: 200, token }).success).toBe(
      true,
    );
    expect(
      groundItemSchema.safeParse({ hex: { q: 0, r: 0 }, itemKey: SWORD, amount: 1, token }).success,
    ).toBe(true);
    expect(
      containerStateSchema.safeParse({
        id: 'c',
        kind: 'chest',
        at: { q: 0, r: 0 },
        contents: [[{ itemKey: SWORD, amount: 1, guaranteed: false, token }]],
        status: 'full',
      }).success,
    ).toBe(true);
  });

  it('refuse a token that does not match the key or holds more than one piece', () => {
    expect(traderGoodSchema.safeParse({ key: 'axe', amount: 1, token }).success).toBe(false);
    expect(listingSchema.safeParse({ key: SWORD, amount: 2, unitPrice: 1, token }).success).toBe(
      false,
    );
    expect(
      groundItemSchema.safeParse({ hex: { q: 0, r: 0 }, itemKey: 'axe', amount: 1, token }).success,
    ).toBe(false);
    expect(
      containerStateSchema.safeParse({
        id: 'c',
        kind: 'chest',
        at: { q: 0, r: 0 },
        contents: [[{ itemKey: 'axe', amount: 1, guaranteed: false, token }]],
        status: 'full',
      }).success,
    ).toBe(false);
  });

  it('refuse a broken token', () => {
    const broken = { ...token, price: 0 };
    expect(traderGoodSchema.safeParse({ key: SWORD, amount: 1, token: broken }).success).toBe(
      false,
    );
  });

  it('a factory token of every gear type fits the entry of its own key', () => {
    const factory = createTokenFactory();
    for (const type of ['sword', 'shield', 'axe', 'pickaxe']) {
      const made = factory.createBase({
        seed: 's',
        sourceId: 'test:entry',
        n: 0,
        realm: token.rarity,
        mapTier: 1,
        type,
      });
      if (!made.ok) throw new Error(made.refusal.code);
      expect(traderGoodSchema.safeParse({ key: type, amount: 1, token: made.value }).success).toBe(
        true,
      );
    }
  });
});
