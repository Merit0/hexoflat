import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { LEGACY_SWORD } from '@hexoflat/engine/tokens/legacy-token-fixtures';
import { mintItem, type InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { heroAggregates, itemLedger } from '../db/schema';
import { createTestKit, envelope, type TestKit } from './player-test-kit';

describe.skipIf(!inject('dbAvailable'))(
  'dimension metadata on journal replay (real Postgres)',
  () => {
    let kit: TestKit;
    beforeAll(() => {
      kit = createTestKit();
    });
    afterAll(async () => {
      await kit.close();
    });

    it('reprojects a legacy token without a second move, ledger write or reroll', async () => {
      const { userId, heroId } = await kit.newPlayer();
      const snapshot = await kit.service.snapshot(userId, heroId);
      const inventory = structuredClone(snapshot.aggregates.inventory!.state as InventoryState);
      const legacy: Record<string, unknown> = { ...LEGACY_SWORD };
      delete legacy.dimension;
      delete legacy.baseKey;
      const cell = mintItem(inventory, 'sword', 1);
      await kit.db
        .update(heroAggregates)
        .set({
          state: {
            ...inventory,
            equip: { ...inventory.equip, weapon: { ...cell, token: legacy } },
          },
        })
        .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, 'inventory')));
      const command = envelope(
        heroId,
        'MOVE_ITEM',
        {
          from: { container: 'equip', slot: 'weapon' },
          to: { container: 'bag', index: 0 },
        },
        inventory.revision,
      );
      const first = await kit.service.execute(userId, command);
      expect(first.result).toBe('applied');
      const firstInventory = first.aggregates.inventory!.state as InventoryState;
      expect(firstInventory.bag[0]?.token).toEqual(LEGACY_SWORD);
      const ledger = await kit.db.select().from(itemLedger).where(eq(itemLedger.heroId, heroId));
      await kit.db
        .update(heroAggregates)
        .set({
          state: {
            ...firstInventory,
            bag: [{ ...firstInventory.bag[0], token: legacy }, ...firstInventory.bag.slice(1)],
          },
        })
        .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, 'inventory')));
      const replay = await kit.service.execute(userId, command);
      expect(replay).toMatchObject({ result: 'applied', replayed: true, events: first.events });
      expect(replay.aggregates.inventory!.state).toEqual(firstInventory);
      expect(await kit.db.select().from(itemLedger).where(eq(itemLedger.heroId, heroId))).toEqual(
        ledger,
      );
    });
  },
);
