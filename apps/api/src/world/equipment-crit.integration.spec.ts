import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type { ProgressState } from '@hexoflat/engine/aggregates/progress-state';
import { mintItem, type InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { upcastToken } from '@hexoflat/engine/inventory/upcast-item-tokens';
import { BATTLE_RULES } from '@hexoflat/engine/battle/battle-content';
import { battleWith, giveTurn, hero, skeleton } from '@hexoflat/engine/battle/battle-test-setup';
import { prepareCritTarget } from '@hexoflat/engine/battle/crit-fixture';
import { createTestKit, envelope, type TestKit } from '../player/player-test-kit';
import {
  ensureExpedition,
  readServerDocument,
  writeServerDocument,
} from '../expedition/expedition-store';
import { deserializeWorld, onHeldMap, placeHeroIn, serializeWorld } from './world-test-support';
import { WorldService } from './world.service';

describe.skipIf(!inject('dbAvailable'))('Weapon crit persistence (real Postgres)', () => {
  let kit: TestKit;
  let world: WorldService;
  beforeAll(() => {
    kit = createTestKit();
    world = new WorldService(kit.db, kit.heroes);
  });
  afterAll(async () => kit.close());

  it.each([0, 2, 3, 4, 5])(
    'a favourable real roll crits with crit-dmg %s (base chance) once and preserves health through replay',
    async (bonus) => {
      const { userId, heroId } = await kit.newPlayer();
      await placeHeroIn(world, userId, heroId, 'camping');
      const snapshot = await kit.service.snapshot(userId, heroId);
      const current = snapshot.aggregates.inventory!;
      const inventory = structuredClone(current.state) as InventoryState;
      const token = {
        ...upcastToken(heroId, 'trophy', 'sword')!,
        attributes: bonus
          ? [
              { key: 'crit-chance', value: 10 },
              { key: 'crit-dmg', value: bonus },
            ]
          : [],
      };
      inventory.equip.weapon = { ...mintItem(inventory, 'sword', 1), token };
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
      player.hands.right!.token = token;
      held.battle = giveTurn(
        battleWith([
          player,
          skeleton(
            'target',
            { q: 1, r: 0 },
            {
              hp: 1,
              kind: 'skeleton-king',
            },
          ),
        ]),
        [heroId, 'target'],
      );
      prepareCritTarget(held.battle);
      held.battle.tokenSecret = { seed: held.worldSeed, mapId: held.mapId };
      await kit.db.transaction((tx) =>
        writeServerDocument(tx, expeditionId, key, JSON.stringify(serializeWorld(held))),
      );
      const sent = {
        commandId: randomUUID(),
        heroId,
        aggregate: 'progress',
        expectedRevision: progress.revision,
        command: {
          type: 'WORLD_BATTLE',
          payload: {
            heroId,
            ...onHeldMap(
              'WORLD_BATTLE',
              {
                kind: 'hero',
                action: { kind: 'strike', targetId: 'target', hand: 'right' },
              },
              state,
            ),
          },
        },
      };
      const damage = 2 * Math.max(BATTLE_RULES.critMultiplier, bonus);
      const answer = await world.execute(userId, sent);
      expect(answer.result).toBe('applied');
      expect(answer.events.find((event) => event.type === 'STRIKE_LANDED')?.payload).toMatchObject({
        critical: true,
        damageBeforeBlock: damage,
        damageDealt: damage,
      });
      const saved = (await load()).battle!;
      expect(saved.creatures.find((creature) => creature.id === 'target')!.hp).toBe(30 - damage);
      expect((await world.execute(userId, sent)).replayed).toBe(true);
      expect((await load()).battle).toEqual(saved);
      world = new WorldService(kit.db, kit.heroes);
      expect((await load()).battle).toEqual(saved);
    },
  );
});
