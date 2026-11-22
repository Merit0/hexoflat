import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createTestKit, envelope, type TestKit } from '../player/player-test-kit';
import { WorldService } from './world.service';
import { onHeldMap } from './world-test-support';

describe.skipIf(!inject('dbAvailable'))('trusted dimension boundaries (real Postgres)', () => {
  let kit: TestKit;
  let world: WorldService;
  beforeAll(() => {
    kit = createTestKit();
    world = new WorldService(kit.db, kit.heroes);
  });
  afterAll(async () => {
    await kit.close();
  });

  it.each([
    { dimension: 'heaven' },
    { origin: { realm: 'spark', mapTier: 4 } },
    { tokenOrigin: { realm: 'spark', mapTier: 4 } },
    { client: { dimension: 'heaven' } },
  ])('rejects forged world source metadata %j before mutation', async (spoof) => {
    const { userId, heroId } = await kit.newPlayer();
    const initial = (await kit.service.snapshot(userId, heroId)).aggregates.progress!;
    await world.execute(userId, {
      commandId: randomUUID(),
      heroId,
      aggregate: 'progress',
      expectedRevision: initial.revision,
      command: { type: 'WORLD_ENTER', payload: { heroId, locationKey: 'camping' } },
    });
    const before = await kit.service.snapshot(userId, heroId);
    const progress = before.aggregates.progress!;
    await expect(
      world.execute(userId, {
        commandId: randomUUID(),
        heroId,
        aggregate: 'progress',
        expectedRevision: progress.revision,
        command: {
          type: 'WORLD_TICK',
          payload: {
            heroId,
            ...onHeldMap('WORLD_TICK', spoof, progress.state),
          },
        },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_COMMAND' });
    expect((await kit.service.snapshot(userId, heroId)).aggregates).toEqual(before.aggregates);
  });

  it.each(['spark', 'gloom'])('refuses a private Earth base requested from %s', async (realm) => {
    const { userId, heroId } = await kit.newPlayer();
    const before = await kit.service.snapshot(userId, heroId);
    const inventory = before.aggregates.inventory!;
    const result = await kit.service.execute(
      userId,
      envelope(
        heroId,
        'DEV_GRANT_ITEM',
        {
          key: 'sword',
          amount: 1,
          token: { type: 'sword', baseKey: 'earth-sword', realm, mapTier: 4 },
        },
        inventory.revision,
      ),
    );
    expect(result).toMatchObject({ result: 'rejected', code: 'BASE_ITEM_NOT_IN_DIMENSION' });
    expect((await kit.service.snapshot(userId, heroId)).aggregates).toEqual(before.aggregates);
  });
});
