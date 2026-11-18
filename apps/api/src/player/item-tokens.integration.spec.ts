import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { CONTENT_VERSION } from '@hexoflat/engine';
import { inventoryV1Fixture } from '@hexoflat/engine/inventory/inventory-v1-fixture';
import type {
  InventoryState,
  InventoryStateItem,
} from '@hexoflat/engine/inventory/inventory-state';
import { heroAggregates } from '../db/schema';
import {
  ensureExpedition,
  readServerDocument,
  writeServerDocument,
} from '../expedition/expedition-store';
import { onHeldMap, placeHeroIn } from '../world/world-test-support';
import { WorldService } from '../world/world.service';
import { createTestKit, envelope, type TestKit } from './player-test-kit';

const dbAvailable = inject('dbAvailable');

function cellsOf(state: InventoryState): (InventoryStateItem | null)[] {
  return [...state.bag, ...Object.values(state.equip), ...state.stash.cells];
}

describe.skipIf(!dbAvailable)('item tokens in stored heroes (real Postgres)', () => {
  let kit: TestKit;
  let world: WorldService;
  beforeAll(() => {
    kit = createTestKit();
    world = new WorldService(kit.db, kit.heroes);
  });
  afterAll(async () => {
    await kit.close();
  });

  async function storeV1Inventory(heroId: string) {
    const stored = JSON.parse(JSON.stringify(inventoryV1Fixture(heroId))) as InventoryState;
    await kit.db
      .update(heroAggregates)
      .set({ schemaVersion: 1, revision: stored.revision, state: stored })
      .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, 'inventory')));
    return stored;
  }

  const inventoryOf = async (userId: string, heroId: string) =>
    (await kit.service.snapshot(userId, heroId)).aggregates.inventory!.state as InventoryState;

  describe('characterization', () => {
    it('loads a stored v1 inventory with the same items in the same places', async () => {
      const { userId, heroId } = await kit.newPlayer();
      const stored = await storeV1Inventory(heroId);
      const loaded = await inventoryOf(userId, heroId);
      expect(cellsOf(loaded).map((cell) => cell?.key ?? null)).toEqual(
        cellsOf(stored).map((cell) => cell?.key ?? null),
      );
      expect(cellsOf(loaded).filter(Boolean)).toHaveLength(6);
      expect(loaded.bag[1]).toEqual(stored.bag[1]);
      expect(loaded.bag[2]).toEqual(stored.bag[2]);
    });

    it('loads a world saved with the current content version on the same map', async () => {
      const { userId, heroId } = await kit.newPlayer();
      const first = (await world.ensure(userId, heroId, 'camping')) as { mapId: string };
      const expeditionId = await ensureExpedition(kit.db, userId, heroId);
      expect(
        await readServerDocument(kit.db, expeditionId, `srv-world:${first.mapId}`),
      ).not.toBeNull();
      const again = (await world.ensure(userId, heroId, 'camping')) as { mapId: string };
      expect(again.mapId).toBe(first.mapId);
    });
  });

  const tokenFields = (cell: InventoryStateItem | null) => {
    const token = cell!.token!;
    return { id: token.id, name: token.name, sprite: token.sprite, attributes: token.attributes };
  };

  const toBag = (heroId: string, revision: number) =>
    envelope(
      heroId,
      'MOVE_ITEM',
      { from: { container: 'equip', slot: 'weapon' }, to: { container: 'bag', index: 10 } },
      revision,
    );

  describe('TG-12: a hero keeps his token through a save and a reload', () => {
    it('saves the token and loads the same name, sprite and attributes', async () => {
      const { userId, heroId } = await kit.newPlayer();
      const stored = await storeV1Inventory(heroId);
      const loaded = await inventoryOf(userId, heroId);
      const before = tokenFields(loaded.equip.weapon);
      expect(loaded.equip.weapon!.token!.type).toBe('sword');

      const moved = await kit.service.execute(userId, toBag(heroId, stored.revision));
      expect(moved.result).toBe('applied');

      const [row] = await kit.db
        .select()
        .from(heroAggregates)
        .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, 'inventory')));
      expect(row.schemaVersion).toBe(3);
      expect((row.state as InventoryState).bag[10]!.token).toEqual(loaded.equip.weapon!.token);

      const reloaded = await inventoryOf(userId, heroId);
      expect(reloaded.equip.weapon).toBeNull();
      expect(tokenFields(reloaded.bag[10])).toEqual(before);
      expect(reloaded.bag[10]!.token).toEqual(loaded.equip.weapon!.token);
    });
  });

  describe('another account', () => {
    it('can neither read nor change the inventory of a hero it does not own', async () => {
      const mine = await kit.newPlayer();
      const other = await kit.newPlayer();
      const stored = await storeV1Inventory(mine.heroId);
      await expect(kit.service.snapshot(other.userId, mine.heroId)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(
        kit.service.execute(other.userId, toBag(mine.heroId, stored.revision)),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      const unchanged = await inventoryOf(mine.userId, mine.heroId);
      expect(unchanged.equip.weapon!.token!.type).toBe('sword');
      expect(unchanged.bag[10]).toBeNull();
    });
  });

  describe('a stale map (D5)', () => {
    async function makeStale(expeditionId: string, mapId: string) {
      const key = `srv-world:${mapId}`;
      const raw = JSON.parse((await readServerDocument(kit.db, expeditionId, key))!) as {
        contentVersion: number;
      };
      raw.contentVersion = CONTENT_VERSION - 1;
      await kit.db.transaction((tx) =>
        writeServerDocument(tx, expeditionId, key, JSON.stringify(raw)),
      );
    }

    it('is replaced by a fresh map with the same id, with one warning and no error', async () => {
      const { userId, heroId } = await kit.newPlayer();
      const first = (await world.ensure(userId, heroId, 'camping')) as { mapId: string };
      const expeditionId = await ensureExpedition(kit.db, userId, heroId);
      await makeStale(expeditionId, first.mapId);
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      try {
        const again = (await world.ensure(userId, heroId, 'camping')) as { mapId: string };
        expect(again.mapId).toBe(first.mapId);
        expect(warn).toHaveBeenCalledTimes(1);
        const saved = JSON.parse(
          (await readServerDocument(kit.db, expeditionId, `srv-world:${first.mapId}`))!,
        ) as { contentVersion: number };
        expect(saved.contentVersion).toBe(CONTENT_VERSION);
        await world.ensure(userId, heroId, 'camping');
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    });

    it('lets a world command run on the fresh map of the place the hero stands in', async () => {
      const { userId, heroId } = await kit.newPlayer();
      await placeHeroIn(world, userId, heroId, 'silesia');
      const progress = (await kit.service.snapshot(userId, heroId)).aggregates.progress!;
      const mapId = (progress.state as { presence: { mapId: string } }).presence.mapId;
      const expeditionId = await ensureExpedition(kit.db, userId, heroId);
      await makeStale(expeditionId, mapId);
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      try {
        const entered = await world.execute(userId, {
          commandId: randomUUID(),
          heroId,
          aggregate: 'progress',
          expectedRevision: progress.revision,
          command: {
            type: 'WORLD_ENTER',
            payload: {
              heroId,
              ...onHeldMap('WORLD_ENTER', { locationKey: 'silesia' }, progress.state),
            },
          },
        });
        expect(entered.result).toBe('applied');
        expect(entered.hero!.mapId).toBe(mapId);
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    });
  });
});
