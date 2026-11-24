import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { LEGACY_SWORD } from '@hexoflat/engine/tokens/legacy-token-fixtures';
import { mintItem, type InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import type { ItemToken } from '@hexoflat/engine/tokens/token-schema';
import { commandJournal, heroAggregates, itemLedger } from '../db/schema';
import { createTestKit, envelope, type TestKit } from './player-test-kit';

function preDa3bToken(token: ItemToken): Record<string, unknown> {
  const { tier, tokenType, description, ...rest } = structuredClone(token);
  return {
    ...rest,
    origin: tier,
    rarity: tokenType,
    description: description.map(({ key, params }) => {
      const { tokenType: name, ...others } = params;
      return {
        key,
        params:
          name === undefined
            ? others
            : { ...others, realm: String(name).replace('.tokenType.', '.realm.') },
      };
    }),
  };
}

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

    it('DA3b: replays a pre-DA3b journal row in the new vocabulary only', async () => {
      const { userId, heroId } = await kit.newPlayer();
      const snapshot = await kit.service.snapshot(userId, heroId);
      const revision = snapshot.aggregates.inventory!.revision;
      const command = envelope(
        heroId,
        'MOVE_ITEM',
        { from: { container: 'bag', index: 0 }, to: { container: 'bag', index: 1 } },
        revision,
        { commandId: randomUUID() },
      );
      const oldContext = { realm: 'gloom', mapTier: 2 };
      await kit.db.insert(commandJournal).values({
        commandId: command.commandId,
        userId,
        heroId,
        aggregateKind: 'inventory',
        commandType: 'MOVE_ITEM',
        payload: command.command.payload,
        expectedRevision: revision,
        result: 'applied',
        events: [
          {
            type: 'CONTAINER_OPENED',
            payload: {
              placed: [{ itemKey: 'sword', amount: 1, token: preDa3bToken(LEGACY_SWORD) }],
              tokenOrigin: oldContext,
              offer: { definition: { rewardOrigin: oldContext } },
            },
          },
        ],
        newRevision: revision + 1,
      });

      const replay = await kit.service.execute(userId, command);

      expect(replay).toMatchObject({ result: 'applied', replayed: true });
      const newContext = { tokenType: 'gloom', mapTier: 2 };
      expect(replay.events).toEqual([
        {
          type: 'CONTAINER_OPENED',
          payload: {
            placed: [{ itemKey: 'sword', amount: 1, token: LEGACY_SWORD }],
            dropContext: newContext,
            offer: { definition: { rewardDropContext: newContext } },
          },
        },
      ]);
      const text = JSON.stringify(replay.events);
      for (const old of [
        '"origin"',
        '"rarity"',
        '"realm"',
        'tokenOrigin',
        'rewardOrigin',
        '.realm.',
      ])
        expect(text).not.toContain(old);
      expect(replay.aggregates.inventory!.revision).toBe(revision);
    });
  },
);
