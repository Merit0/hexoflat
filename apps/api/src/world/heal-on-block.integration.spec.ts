import { randomUUID } from 'node:crypto';
import { BATTLE_RULES } from '@hexoflat/engine/battle/battle-content';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
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
import { createTestKit, envelope, type TestKit } from '../player/player-test-kit';
import {
  ensureExpedition,
  readServerDocument,
  writeServerDocument,
} from '../expedition/expedition-store';
import { deserializeWorld, onHeldMap, placeHeroIn, serializeWorld } from './world-test-support';
import { WorldService } from './world.service';

describe.skipIf(!inject('dbAvailable'))('shield healing persistence (real Postgres)', () => {
  let kit: TestKit;
  let world: WorldService;
  beforeAll(() => {
    kit = createTestKit();
    world = new WorldService(kit.db, kit.heroes);
  });
  afterAll(async () => kit.close());

  it.each([0, 1, 4])(
    'persists +%s healing through a real block, reload and command replay',
    async (bonus) => {
      const { userId, heroId } = await kit.newPlayer();
      await placeHeroIn(world, userId, heroId, 'camping');
      const snapshot = await kit.service.snapshot(userId, heroId);
      const current = snapshot.aggregates.inventory!;
      const inventory = structuredClone(current.state) as InventoryState;
      const token = {
        ...upcastToken(heroId, 'healing', 'shield')!,
        attributes: bonus ? [{ key: 'heal-on-block', value: bonus }] : [],
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
      const player = hero({ q: 0, r: 0 }, { id: heroId, hp: 2 });
      player.hands.left!.token = token;
      const ready = giveTurn(battleWith([player, skeleton('enemy', { q: 1, r: 0 })]), [
        'enemy',
        heroId,
      ]);
      ready.turnWill = BATTLE_RULES.strike;
      held.battle = strikeOpened(ready, 'enemy', heroId, 'right', Date.now());
      held.battle.tokenSecret = { seed: held.worldSeed, mapId: held.mapId };
      await kit.db.transaction((tx) =>
        writeServerDocument(tx, expeditionId, key, JSON.stringify(serializeWorld(held))),
      );
      const command = (revision: number, action: Record<string, unknown>) => ({
        commandId: randomUUID(),
        heroId,
        aggregate: 'progress',
        expectedRevision: revision,
        command: {
          type: 'WORLD_BATTLE',
          payload: { heroId, ...onHeldMap('WORLD_BATTLE', { kind: 'hero', action }, state) },
        },
      });
      const place = command(progress.revision, { kind: 'place-shield', hex: { q: 1, r: 0 } });
      expect((await world.execute(userId, place)).result).toBe('applied');
      const next = (await kit.service.snapshot(userId, heroId)).aggregates.progress!;
      const clock = vi.spyOn(Date, 'now').mockReturnValue(held.battle.reaction!.deadlineMs);
      try {
        const finish = command(next.revision, { kind: 'reaction-timeout' });
        const answer = await world.execute(userId, finish);
        expect(answer.result).toBe('applied');
        expect(
          (await load()).battle!.creatures.find((creature) => creature.id === heroId)!.hp,
        ).toBe(2 + bonus);
        expect(answer.events.filter((event) => event.type === 'CREATURE_HEALED')).toHaveLength(
          bonus ? 1 : 0,
        );
        world = new WorldService(kit.db, kit.heroes);
        expect((await world.execute(userId, finish)).replayed).toBe(true);
        const restored = (await kit.service.snapshot(userId, heroId)).aggregates.progress!
          .state as ProgressState;
        expect(restored.health.current).toBe(1 + bonus / 2);
        expect(
          (await load()).battle!.creatures.find((creature) => creature.id === heroId)!.hp,
        ).toBe(2 + bonus);
      } finally {
        clock.mockRestore();
      }
    },
  );
});
