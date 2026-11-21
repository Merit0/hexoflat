import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type { ProgressState } from '@hexoflat/engine/aggregates/progress-state';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { upcastToken } from '@hexoflat/engine/inventory/upcast-item-tokens';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { deserializeWorld, onHeldMap, placeHeroIn } from './world-test-support';
import { ensureExpedition, readServerDocument } from '../expedition/expedition-store';
import { createTestKit, envelope, type TestKit } from '../player/player-test-kit';
import { WorldService } from './world.service';

describe.skipIf(!inject('dbAvailable'))('EA-11 Smart Step persistence (real Postgres)', () => {
  let kit: TestKit;
  let world: WorldService;
  beforeAll(() => {
    kit = createTestKit();
    world = new WorldService(kit.db, kit.heroes);
  });
  afterAll(async () => kit.close());

  async function progress(userId: string, heroId: string) {
    const projection = (await kit.service.snapshot(userId, heroId)).aggregates.progress!;
    return { ...projection, state: projection.state as ProgressState };
  }

  async function send(
    userId: string,
    heroId: string,
    type: string,
    payload: Record<string, unknown>,
    commandId: string = randomUUID(),
  ) {
    const current = await progress(userId, heroId);
    return world.execute(userId, {
      commandId,
      heroId,
      aggregate: 'progress',
      expectedRevision: current.revision,
      command: { type, payload: { heroId, ...onHeldMap(type, payload, current.state) } },
    });
  }

  async function equip(userId: string, heroId: string, every: number, equipped = true) {
    const current = (await kit.service.snapshot(userId, heroId)).aggregates.inventory!;
    const inventory = structuredClone(current.state) as InventoryState;
    inventory.equip.shield = null;
    inventory.bag[0] = null;
    const item = {
      id: `${heroId}:smart-step`,
      key: 'shield' as const,
      type: EHexobjectGroup.EQUIPMENT,
      amount: 1,
      token: {
        ...upcastToken(heroId, 'smart-step', 'shield')!,
        attributes: [{ key: 'smart-step', value: every }],
      },
    };
    if (equipped) inventory.equip.shield = item;
    else inventory.bag[0] = item;
    const result = await kit.service.execute(
      userId,
      envelope(heroId, 'DEV_SET_INVENTORY', { inventory }, current.revision),
    );
    expect(result.result).toBe('applied');
  }

  async function walk(userId: string, heroId: string, commandId?: string) {
    const current = await progress(userId, heroId);
    const expedition = await ensureExpedition(kit.db, userId, heroId);
    const saved = await readServerDocument(
      kit.db,
      expedition,
      `srv-world:${current.state.presence!.mapId}`,
    );
    const held = deserializeWorld(JSON.parse(saved!), 0);
    const target = getHexNeighbors(held.heroCoordinates!).find((at) =>
      held.map.tiles.some(
        (tile) =>
          tile.coordinates.columnIndex === at.columnIndex &&
          tile.coordinates.rowIndex === at.rowIndex &&
          tile.isRevealed &&
          !tile.hexobject &&
          tile.terrain === 'ground',
      ),
    );
    expect(target).toBeDefined();
    const result = await send(userId, heroId, 'WORLD_STEP', { target }, commandId);
    return { result, target };
  }

  it('waives four of twenty paid-zone steps, preserves reloads and never reapplies a replay', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await equip(userId, heroId, 5);
    await placeHeroIn(world, userId, heroId, 'silesia');
    expect((await send(userId, heroId, 'WORLD_ENTER', { locationKey: 'silesia' })).result).toBe(
      'applied',
    );
    for (let index = 0; index < 20; index++) {
      expect((await walk(userId, heroId)).result.result).toBe('applied');
      // A fresh service reads the saved aggregate/map, rather than retaining a local counter.
      world = new WorldService(kit.db, kit.heroes);
      expect((await progress(userId, heroId)).state.paidSteps).toBe(index + 1);
    }
    expect((await progress(userId, heroId)).state).toMatchObject({
      steps: 20,
      paidSteps: 20,
      knowledge: { current: 34 },
    });
    const commandId = randomUUID();
    const before = await progress(userId, heroId);
    const { result, target } = await walk(userId, heroId, commandId);
    expect(result.result).toBe('applied');
    const replay = await world.execute(userId, {
      commandId,
      heroId,
      aggregate: 'progress',
      expectedRevision: before.revision,
      command: {
        type: 'WORLD_STEP',
        payload: { heroId, ...onHeldMap('WORLD_STEP', { target }, before.state) },
      },
    });
    expect(replay.replayed).toBe(true);
    expect((await progress(userId, heroId)).state).toMatchObject({
      paidSteps: 21,
      knowledge: { current: 33 },
    });
  });

  it('loads owned equipment for the legacy KNOWLEDGE step path too', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await equip(userId, heroId, 1);
    await placeHeroIn(world, userId, heroId, 'silesia');
    const current = await progress(userId, heroId);
    const target = getHexNeighbors(current.state.presence!.coordinates)[0];
    const result = await kit.service.execute(
      userId,
      envelope(
        heroId,
        'KNOWLEDGE',
        {
          revision: current.state.knowledge.revision,
          action: { kind: 'step', target },
        },
        current.revision,
        { aggregate: 'progress' },
      ),
    );
    expect(result.result).toBe('applied');
    expect((await progress(userId, heroId)).state).toMatchObject({
      paidSteps: 1,
      knowledge: { current: 50 },
    });
  });

  it('keeps the phase through camp, bag/equip swaps and rejected zero-Will steps', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await equip(userId, heroId, 5, false);
    await placeHeroIn(world, userId, heroId, 'silesia');
    for (let index = 0; index < 4; index++)
      expect((await walk(userId, heroId)).result.result).toBe('applied');
    expect((await progress(userId, heroId)).state.knowledge.current).toBe(46);
    await placeHeroIn(world, userId, heroId, 'camping');
    expect((await walk(userId, heroId)).result.result).toBe('applied');
    expect((await progress(userId, heroId)).state.paidSteps).toBe(4);
    await equip(userId, heroId, 5);
    await placeHeroIn(world, userId, heroId, 'silesia');
    const current = await progress(userId, heroId);
    const spent = await kit.service.execute(
      userId,
      envelope(
        heroId,
        'DEV_SET_KNOWLEDGE',
        {
          revision: current.state.knowledge.revision,
          knowledge: { ...current.state.knowledge, current: 0 },
        },
        current.revision,
        { aggregate: 'progress' },
      ),
    );
    expect(spent.result).toBe('applied');
    expect((await walk(userId, heroId)).result.result).toBe('applied');
    expect((await progress(userId, heroId)).state).toMatchObject({
      paidSteps: 5,
      knowledge: { current: 0 },
    });
    const before = await progress(userId, heroId);
    expect((await walk(userId, heroId)).result).toMatchObject({
      result: 'rejected',
      code: 'INSUFFICIENT_WILL',
    });
    expect(await progress(userId, heroId)).toEqual(before);
    await equip(userId, heroId, 3);
    expect((await walk(userId, heroId)).result.result).toBe('applied');
    expect((await progress(userId, heroId)).state.paidSteps).toBe(6);
  });
});
