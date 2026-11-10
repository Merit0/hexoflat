import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { campObjectSpots } from '@hexoflat/engine/content/boards/camp-object-spot';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { commandJournal } from '../db/schema';
import { createTestKit, envelope, type TestKit } from './player-test-kit';

const dbAvailable = inject('dbAvailable');
const CAMP_MAP_ID = randomUUID();
const COINS = HEXOBJECT_KEYS.COINS;
const [CHEST] = campObjectSpots(HEXOBJECT_KEYS.STASH_CHEST);
const NEAR = getHexNeighbors(CHEST)[0];
const FAR = { columnIndex: CHEST.columnIndex + 2, rowIndex: CHEST.rowIndex };

describe.skipIf(!dbAvailable)(
  'the stash answers only next to the camp chest (real Postgres)',
  () => {
    let kit: TestKit;
    beforeAll(() => {
      kit = createTestKit();
    });
    afterAll(async () => {
      await kit.close();
    });

    const inventoryOf = async (userId: string, heroId: string) =>
      (await kit.service.snapshot(userId, heroId)).aggregates.inventory!;

    async function heroInCamp(at: { columnIndex: number; rowIndex: number }) {
      const { userId, heroId } = await kit.newPlayer();
      const arrive = envelope(
        heroId,
        'ARRIVE',
        { locationKey: 'camping', mapId: CAMP_MAP_ID, coordinates: at },
        0,
        { aggregate: 'progress' },
      );
      delete (arrive.command.payload as { revision?: number }).revision;
      expect((await kit.service.execute(userId, arrive)).result).toBe('applied');
      const claimed = await kit.service.execute(
        userId,
        envelope(heroId, 'CLAIM_CAMP_CHEST', {}, 0),
      );
      expect(claimed.result).toBe('applied');
      const granted = await kit.service.execute(
        userId,
        envelope(heroId, 'DEV_GRANT_ITEM', { key: COINS, amount: 150 }, 1),
      );
      expect(granted.result).toBe('applied');
      return { userId, heroId };
    }

    const coinsIndex = (inventory: { state: unknown }) =>
      (inventory.state as InventoryState).bag.findIndex((cell) => cell?.key === COINS);

    const moveCommand = (heroId: string, revision: number, from: object, to: object) =>
      envelope(heroId, 'MOVE_ITEM', { from, to, split: false }, revision);

    it('refuses a move into the stash far from the chest and keeps the inventory and its revision', async () => {
      const { userId, heroId } = await heroInCamp(FAR);
      const before = await inventoryOf(userId, heroId);
      const command = moveCommand(
        heroId,
        before.revision,
        { container: 'bag', index: coinsIndex(before) },
        { container: 'stash', index: 10 },
      );

      const answer = await kit.service.execute(userId, command);

      expect(answer).toMatchObject({ result: 'rejected', code: 'STASH_LOCKED' });
      expect(await inventoryOf(userId, heroId)).toEqual(before);
      const [row] = await kit.db
        .select()
        .from(commandJournal)
        .where(
          and(eq(commandJournal.heroId, heroId), eq(commandJournal.commandId, command.commandId)),
        );
      expect(row).toMatchObject({ result: 'rejected', reason: 'STASH_LOCKED' });
    });

    it('refuses sorting, storing resources and taking out of the stash far from the chest', async () => {
      const { userId, heroId } = await heroInCamp(FAR);
      const { revision } = await inventoryOf(userId, heroId);
      const commands = [
        envelope(heroId, 'SORT_STASH', {}, revision),
        envelope(heroId, 'STORE_RESOURCES', {}, revision),
        moveCommand(
          heroId,
          revision,
          { container: 'stash', index: 0 },
          { container: 'bag', index: 0 },
        ),
      ];
      for (const command of commands) {
        expect(await kit.service.execute(userId, command)).toMatchObject({
          result: 'rejected',
          code: 'STASH_LOCKED',
        });
      }
      expect((await inventoryOf(userId, heroId)).revision).toBe(revision);
    });

    it('moves into the stash next to the chest', async () => {
      const { userId, heroId } = await heroInCamp(NEAR);
      const before = await inventoryOf(userId, heroId);
      const answer = await kit.service.execute(
        userId,
        moveCommand(
          heroId,
          before.revision,
          { container: 'bag', index: coinsIndex(before) },
          { container: 'stash', index: 10 },
        ),
      );
      expect(answer.result).toBe('applied');
      expect((answer.aggregates.inventory!.state as InventoryState).stash.cells[10]).toMatchObject({
        key: COINS,
        amount: 150,
      });
    });

    it('moves coins from the bag into a hand anywhere, and buys a chest only next to it', async () => {
      const { userId, heroId } = await heroInCamp(FAR);
      const before = await inventoryOf(userId, heroId);
      const held = await kit.service.execute(
        userId,
        moveCommand(
          heroId,
          before.revision,
          { container: 'bag', index: coinsIndex(before) },
          { container: 'equip', slot: 'weapon' },
        ),
      );
      expect(held.result).toBe('applied');
      const revision = held.aggregates.inventory!.revision;

      const far = await kit.service.execute(
        userId,
        envelope(heroId, 'UNLOCK_STASH_CHEST', {}, revision),
      );
      expect(far).toMatchObject({ result: 'rejected', code: 'STASH_LOCKED' });
      expect((await inventoryOf(userId, heroId)).state).toMatchObject({
        stash: { chests: 1 },
        equip: { weapon: { key: COINS, amount: 150 } },
      });

      const progress = (await kit.service.snapshot(userId, heroId)).aggregates.progress!;
      const step = envelope(
        heroId,
        'ARRIVE',
        { locationKey: 'camping', mapId: CAMP_MAP_ID, coordinates: NEAR },
        progress.revision,
        { aggregate: 'progress' },
      );
      delete (step.command.payload as { revision?: number }).revision;
      expect((await kit.service.execute(userId, step)).result).toBe('applied');

      const near = await kit.service.execute(
        userId,
        envelope(heroId, 'UNLOCK_STASH_CHEST', {}, revision),
      );
      expect(near.result).toBe('applied');
      expect((near.aggregates.inventory!.state as InventoryState).stash.chests).toBe(2);
    });
  },
);
