import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type { ProgressState } from '@hexoflat/engine/aggregates/progress-state';
import { mintItem, type InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { upcastToken } from '@hexoflat/engine/inventory/upcast-item-tokens';
import {
  battleWith,
  giveTurn,
  hero,
  skeleton,
  strikeOpened,
} from '@hexoflat/engine/battle/battle-test-setup';
import { shieldCapacity } from '@hexoflat/engine/battle/defend';
import { BATTLE_RULES } from '@hexoflat/engine/battle/battle-content';
import { createTestKit, envelope, type TestKit } from '../player/player-test-kit';
import {
  ensureExpedition,
  readServerDocument,
  writeServerDocument,
} from '../expedition/expedition-store';
import { deserializeWorld, onHeldMap, placeHeroIn, serializeWorld } from './world-test-support';
import { WorldService } from './world.service';

describe.skipIf(!inject('dbAvailable'))('Block sides persistence (real Postgres)', () => {
  let kit: TestKit;
  let world: WorldService;
  beforeAll(() => {
    kit = createTestKit();
    world = new WorldService(kit.db, kit.heroes);
  });
  afterAll(async () => kit.close());

  it.each([0, 1, 2, 3, 4])(
    'enforces base plus %s sides across replay and reload',
    async (bonus) => {
      const { userId, heroId } = await kit.newPlayer();
      await placeHeroIn(world, userId, heroId, 'camping');
      const current = (await kit.service.snapshot(userId, heroId)).aggregates.inventory!;
      const inventory = structuredClone(current.state) as InventoryState;
      const token = {
        ...upcastToken(heroId, 'block', 'shield')!,
        attributes: bonus ? [{ key: 'shield', value: bonus }] : [],
      };
      inventory.equip.shield = { ...mintItem(inventory, 'shield', 1), token };
      expect(
        (
          await kit.service.execute(
            userId,
            envelope(heroId, 'DEV_SET_INVENTORY', { inventory }, current.revision),
          )
        ).result,
      ).toBe('applied');
      const progress = (await kit.service.snapshot(userId, heroId)).aggregates.progress!;
      const state = progress.state as ProgressState;
      const expeditionId = await ensureExpedition(kit.db, userId, heroId);
      const key = `srv-world:${state.presence!.mapId}`;
      const load = async () =>
        deserializeWorld(JSON.parse((await readServerDocument(kit.db, expeditionId, key))!), 0);
      const held = await load();
      const player = hero({ q: 0, r: 0 }, { id: heroId });
      player.hands.left!.token = token;
      held.battle = strikeOpened(
        giveTurn(battleWith([player, skeleton('enemy', { q: 1, r: 0 })]), ['enemy', heroId]),
        'enemy',
        heroId,
        'right',
        Date.now(),
      );
      held.battle.reaction!.deadlineMs += 60_000;
      held.battle.tokenSecret = { seed: held.worldSeed, mapId: held.mapId };
      await kit.db.transaction((tx) =>
        writeServerDocument(tx, expeditionId, key, JSON.stringify(serializeWorld(held))),
      );
      const hexes = [
        { q: 1, r: 0 },
        { q: 0, r: 1 },
        { q: -1, r: 1 },
        { q: -1, r: 0 },
        { q: 0, r: -1 },
        { q: 1, r: -1 },
      ];
      for (let index = 0; index <= bonus + 1; index++) {
        const next = (await kit.service.snapshot(userId, heroId)).aggregates.progress!;
        const sent = {
          commandId: randomUUID(),
          heroId,
          aggregate: 'progress',
          expectedRevision: next.revision,
          command: {
            type: 'WORLD_BATTLE',
            payload: {
              heroId,
              ...onHeldMap(
                'WORLD_BATTLE',
                { kind: 'hero', action: { kind: 'place-shield', hex: hexes[index] } },
                state,
              ),
            },
          },
        };
        const answer = await world.execute(userId, sent);
        expect(answer.result).toBe(index <= bonus ? 'applied' : 'rejected');
        expect((await load()).battle!.placedShields).toHaveLength(Math.min(index + 1, bonus + 1));
        expect((await world.execute(userId, sent)).replayed).toBe(true);
      }
      world = new WorldService(kit.db, kit.heroes);
      const restored = (await load()).battle!;
      expect(
        shieldCapacity(
          restored.creatures.find((creature) => creature.id === heroId)!,
          BATTLE_RULES,
        ),
      ).toBe(1 + bonus);
      expect(restored.placedShields).toHaveLength(1 + bonus);
    },
  );
});
