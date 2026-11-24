import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { TRADERS, type ProgressState } from '@hexoflat/engine';
import { campObjectSpots } from '@hexoflat/engine/content/boards/camp-object-spot';
import { rollChestLoot } from '@hexoflat/engine/chests/plan-chest-loot';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { isTokenType } from '@hexoflat/engine/tokens/game-tokens';
import { sellPriceOf } from '@hexoflat/engine/trade/price-of';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { worldDropContext } from '@hexoflat/engine/world/server-world';
import {
  ensureExpedition,
  readServerDocument,
  writeServerDocument,
} from '../expedition/expedition-store';
import {
  EHexActionTypeForTests,
  deserializeWorld,
  onHeldMap,
  placeHeroIn,
  serializeWorld,
} from '../world/world-test-support';
import { WorldService } from '../world/world.service';
import { createTestKit, envelope, type TestKit } from './player-test-kit';

const dbAvailable = inject('dbAvailable');
const { CHEST, SWORD, HAND } = HEXOBJECT_KEYS;
const [STALL] = campObjectSpots(HEXOBJECT_KEYS.TRADER_STALL);
const NEAR_STALL = getHexNeighbors(STALL)[0];
const TIER = 3;

describe.skipIf(!dbAvailable)('LG5b game rules read item tokens (real Postgres)', () => {
  let kit: TestKit;
  let world: WorldService;
  beforeAll(() => {
    kit = createTestKit();
    world = new WorldService(kit.db, kit.heroes);
  });
  afterAll(async () => {
    await kit.close();
  });

  const progressOf = async (userId: string, heroId: string) =>
    (await kit.service.snapshot(userId, heroId)).aggregates.progress!;
  const inventoryOf = async (userId: string, heroId: string) =>
    (await kit.service.snapshot(userId, heroId)).aggregates.inventory!;

  async function sendWorld(userId: string, heroId: string, type: string, payload: object) {
    const progress = await progressOf(userId, heroId);
    return world.execute(userId, {
      commandId: randomUUID(),
      heroId,
      aggregate: 'progress',
      expectedRevision: progress.revision,
      command: { type, payload: { heroId, ...onHeldMap(type, { ...payload }, progress.state) } },
    });
  }

  async function heldWorld(userId: string, heroId: string) {
    const expeditionId = await ensureExpedition(kit.db, userId, heroId);
    const state = (await progressOf(userId, heroId)).state as { presence: { mapId: string } };
    const docKey = `srv-world:${state.presence.mapId}`;
    const raw = (await readServerDocument(kit.db, expeditionId, docKey))!;
    return { expeditionId, docKey, loaded: deserializeWorld(JSON.parse(raw), 0) };
  }

  function chestSpotWithGear(loaded: ReturnType<typeof deserializeWorld>) {
    const loot = {
      seed: loaded.worldSeed,
      sourceId: loaded.mapId,
      dropContext: worldDropContext(loaded),
    };
    const tileAt = (spot: { columnIndex: number; rowIndex: number }) =>
      loaded.map.tiles.find(
        (t) =>
          t.coordinates.columnIndex === spot.columnIndex &&
          t.coordinates.rowIndex === spot.rowIndex,
      );
    const isFree = (spot: { columnIndex: number; rowIndex: number }) => {
      const tile = tileAt(spot);
      return !!tile && !tile.hexobject && tile.terrain === 'ground';
    };
    const hero = loaded.heroCoordinates!;
    for (const spot of getHexNeighbors(hero)) {
      const tile = tileAt(spot);
      if (!tile || !isFree(spot)) continue;
      const room = getHexNeighbors(spot).filter(
        (next) =>
          isFree(next) &&
          !(next.columnIndex === hero.columnIndex && next.rowIndex === hero.rowIndex),
      ).length;
      tile.hexobject = HexObjectFactory.create(CHEST, spot);
      const drops = rollChestLoot(tile, loot);
      if (drops.length <= room && drops.some((drop) => isTokenType(drop.itemKey))) return tile;
      tile.hexobject = null;
    }
    return null;
  }

  async function caveWithGearChest() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const { userId, heroId } = await kit.newPlayer();
      await placeHeroIn(world, userId, heroId, 'cave');
      await sendWorld(userId, heroId, 'WORLD_ENTER', { locationKey: 'cave' });
      const { expeditionId, docKey, loaded } = await heldWorld(userId, heroId);
      if (loaded.descriptor?.kind !== 'RECIPE') throw new Error('the cave is not a recipe board');
      loaded.descriptor.params = { ...loaded.descriptor.params, tier: TIER };
      loaded.dropContext = { ...worldDropContext(loaded), mapTier: TIER };
      const tile = chestSpotWithGear(loaded);
      if (!tile) continue;
      tile.isRevealed = true;
      await kit.db.transaction((tx) =>
        writeServerDocument(tx, expeditionId, docKey, JSON.stringify(serializeWorld(loaded))),
      );
      return { userId, heroId, spot: tile.coordinates };
    }
    throw new Error('no cave chest with gear in 10 heroes');
  }

  it('opening a chest on a cave board gives gloom tokens of the board tier', async () => {
    const { userId, heroId, spot } = await caveWithGearChest();
    const opened = await sendWorld(userId, heroId, 'WORLD_ACTION', {
      coordinates: spot,
      actionType: EHexActionTypeForTests.OPEN,
      toolKey: HAND,
    });
    expect(opened.result).toBe('applied');
    expect(opened.events.map((event) => event.type)).toContain('CONTAINER_OPENED');

    const { loaded } = await heldWorld(userId, heroId);
    const onMap = loaded.map.tiles
      .map((tile) => tile.hexobject)
      .filter((object) => object && isTokenType(object.hexobjectKey));
    const inBag = ((await inventoryOf(userId, heroId)).state as InventoryState).bag.filter(
      (cell) => cell && isTokenType(cell.key),
    );
    const tokens = [...onMap.map((object) => object!.token), ...inBag.map((cell) => cell!.token)];
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) {
      expect(token).toMatchObject({ tokenType: 'gloom', mapTier: TIER, tier: 'base' });
      expect(token!.id.startsWith('chest:')).toBe(true);
    }
  });

  it('selling a token pays its sell price, which is below its buy price', async () => {
    const { userId, heroId } = await kit.newPlayer();
    const progress = await progressOf(userId, heroId);
    const arrive = envelope(
      heroId,
      'ARRIVE',
      { locationKey: 'camping', mapId: randomUUID(), coordinates: NEAR_STALL },
      progress.revision,
      { aggregate: 'progress' },
    );
    delete (arrive.command.payload as { revision?: number }).revision;
    expect((await kit.service.execute(userId, arrive)).result).toBe('applied');
    const granted = await kit.service.execute(
      userId,
      envelope(heroId, 'DEV_GRANT_ITEM', { key: SWORD, amount: 1 }, 0),
    );
    expect(granted.result).toBe('applied');
    const inventory = granted.aggregates.inventory!;
    const index = (inventory.state as InventoryState).bag.findIndex((cell) => cell?.key === SWORD);
    const sword = (inventory.state as InventoryState).bag[index]!;
    expect(sword.token).toBeDefined();
    const sellPrice = sellPriceOf(TRADERS.ilva, sword)!;
    expect(sellPrice).toBeLessThan(sword.token!.price);

    const sold = await kit.service.execute(
      userId,
      envelope(
        heroId,
        'SHOP_SELL',
        {
          trader: 'ilva',
          from: { container: 'bag', index },
          split: false,
          expectedPrice: sellPrice,
        },
        inventory.revision,
      ),
    );

    expect(sold.result).toBe('applied');
    const buyback = ((await progressOf(userId, heroId)).state as ProgressState).traders.ilva!
      .buyback[0];
    expect(buyback).toMatchObject({ key: SWORD, unitPrice: sellPrice, token: sword.token });
  });
});
