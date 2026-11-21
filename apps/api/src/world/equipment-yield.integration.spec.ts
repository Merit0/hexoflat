import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import type { ProgressState } from '@hexoflat/engine/aggregates/progress-state';
import { mintItem } from '@hexoflat/engine/inventory/inventory-state';
import { upcastToken } from '@hexoflat/engine/inventory/upcast-item-tokens';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { createTestKit, envelope, type TestKit } from '../player/player-test-kit';
import { WorldService } from './world.service';
import { deserializeWorld, onHeldMap, placeHeroIn } from './world-test-support';

describe.skipIf(!inject('dbAvailable'))('A08 Yield persistence (real Postgres)', () => {
  let kit: TestKit;
  let world: WorldService;
  beforeAll(() => {
    kit = createTestKit();
    world = new WorldService(kit.db, kit.heroes);
  });
  afterAll(async () => kit.close());

  async function send(userId: string, heroId: string, type: string, payload = {}) {
    const current = (await kit.service.snapshot(userId, heroId)).aggregates.progress!;
    return world.execute(userId, {
      commandId: randomUUID(),
      heroId,
      aggregate: 'progress',
      expectedRevision: current.revision,
      command: { type, payload: { heroId, ...onHeldMap(type, payload, current.state) } },
    });
  }

  it.each([
    { tool: 'axe', resource: 'tree', action: EHexActionType.CUT, amount: 3, questId: 'woodcutter' },
    {
      tool: 'pickaxe',
      resource: 'rock',
      action: EHexActionType.MINE,
      amount: 12,
      questId: 'stonebreaker',
    },
  ] as const)(
    '$tool keeps the bonus through a new service and grants it once',
    async ({ tool, resource, action, amount, questId }) => {
      const { userId, heroId } = await kit.newPlayer();
      await placeHeroIn(world, userId, heroId, 'camping');
      const current = (await kit.service.snapshot(userId, heroId)).aggregates.inventory!;
      const inventory = structuredClone(current.state) as InventoryState;
      inventory.equip.weapon = {
        ...mintItem(inventory, tool, 1),
        token: {
          ...upcastToken(heroId, 'harvest', tool)!,
          attributes: [{ key: 'yield', value: 2 }],
        },
      };
      expect(
        (
          await kit.service.execute(
            userId,
            envelope(heroId, 'DEV_SET_INVENTORY', { inventory }, current.revision),
          )
        ).result,
      ).toBe('applied');
      const previous = process.env.HEXOFLAT_E2E_FIXTURES;
      let at: IHexCoordinates;
      process.env.HEXOFLAT_E2E_FIXTURES = '1';
      try {
        await kit.service.questFixture(userId, heroId, {
          active: [{ questId, progress: 0, state: 'active' }],
        });
        const placed = (await world.worldFixture(userId, heroId, {
          kind: 'place-hexobject',
          key: resource,
        })) as { coordinates: IHexCoordinates };
        at = placed.coordinates;
      } finally {
        if (previous === undefined) delete process.env.HEXOFLAT_E2E_FIXTURES;
        else process.env.HEXOFLAT_E2E_FIXTURES = previous;
      }
      const start = await send(userId, heroId, 'WORLD_ACTION', {
        coordinates: at,
        actionType: action,
        toolKey: tool,
        client: {
          tool: { dragging: true, active: tool, hover: at, itemId: inventory.equip.weapon.id },
        },
      });
      expect(start.result).toBe('applied');
      const loaded = new WorldService(kit.db, kit.heroes);
      const held = deserializeWorld(await loaded.snapshot(userId, heroId), Date.now());
      expect(held.map.tiles.find((tile) => tile.pendingAction)?.pendingAction?.harvestBonus).toBe(
        2,
      );
      const now = Date.now();
      const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 60_000);
      try {
        world = loaded;
        const done = await send(userId, heroId, 'WORLD_TICK');
        expect(done.effects).toContainEqual({ kind: 'gather', key: resource, amount });
        const progress = (await kit.service.snapshot(userId, heroId)).aggregates.progress!
          .state as ProgressState;
        expect(progress.quests.active[0].progress).toBe(1);
        const again = await send(userId, heroId, 'WORLD_TICK');
        expect(again.effects.some((effect) => effect.kind === 'gather')).toBe(false);
      } finally {
        clock.mockRestore();
      }
    },
  );
});
