import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { ProgressState } from '@hexoflat/engine/aggregates/progress-state';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { upcastToken } from '@hexoflat/engine/inventory/upcast-item-tokens';
import { CAMP_BOOK_HEX } from '@hexoflat/engine/knowledge/camp-book';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { battleWith, giveTurn, hero, skeleton } from '@hexoflat/engine/battle/battle-test-setup';
import { createTestKit, envelope, type TestKit } from '../player/player-test-kit';
import {
  ensureExpedition,
  readServerDocument,
  writeServerDocument,
} from '../expedition/expedition-store';
import { deserializeWorld, onHeldMap, placeHeroIn, serializeWorld } from './world-test-support';
import { WorldService } from './world.service';

describe.skipIf(!inject('dbAvailable'))('A05 Wisdom persistence (real Postgres)', () => {
  let kit: TestKit;
  let world: WorldService;
  beforeAll(() => {
    kit = createTestKit();
    world = new WorldService(kit.db, kit.heroes);
  });
  afterAll(async () => kit.close());

  async function progress(userId: string, heroId: string) {
    const current = (await kit.service.snapshot(userId, heroId)).aggregates.progress!;
    return { ...current, state: current.state as ProgressState };
  }

  async function command(
    userId: string,
    heroId: string,
    type: string,
    payload: Record<string, unknown>,
  ) {
    const current = await progress(userId, heroId);
    const sent = envelope(
      heroId,
      type,
      { revision: current.state.knowledge.revision, ...payload },
      current.revision,
      { aggregate: 'progress' },
    );
    if (type === 'ARRIVE') delete (sent.command.payload as { revision?: number }).revision;
    return kit.service.execute(userId, sent);
  }

  async function player() {
    const { userId, heroId } = await kit.newPlayer();
    const current = (await kit.service.snapshot(userId, heroId)).aggregates.inventory!;
    const inventory = structuredClone(current.state) as InventoryState;
    inventory.equip.shield = {
      id: `${heroId}:wisdom`,
      key: 'shield',
      type: EHexobjectGroup.EQUIPMENT,
      amount: 1,
      token: {
        ...upcastToken(heroId, 'wisdom', 'shield')!,
        attributes: [{ key: 'wisdom', value: 4 }],
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
    const saved = await progress(userId, heroId);
    expect(
      (
        await command(userId, heroId, 'DEV_SET_KNOWLEDGE', {
          knowledge: { ...saved.state.knowledge, current: 10 },
        })
      ).result,
    ).toBe('applied');
    return { userId, heroId };
  }

  it('adds Wisdom to a correct Hall answer and saves the total across snapshots', async () => {
    const { userId, heroId } = await player();
    expect(
      (
        await command(userId, heroId, 'ARRIVE', {
          locationKey: 'camping',
          mapId: 'camp',
          coordinates: getHexNeighbors(CAMP_BOOK_HEX)[0],
        })
      ).result,
    ).toBe('applied');
    expect(
      (
        await command(userId, heroId, 'KNOWLEDGE', {
          action: { kind: 'start', mode: 'hall', seed: 'wisdom' },
        })
      ).result,
    ).toBe('applied');
    const current = await progress(userId, heroId);
    const session = current.state.knowledge.session!;
    const sent = envelope(
      heroId,
      'KNOWLEDGE',
      {
        revision: current.state.knowledge.revision,
        action: {
          kind: 'answer',
          sessionId: session.id,
          questionId: session.question.id,
          answer: session.question.answer,
          elapsedMs: 500,
        },
      },
      current.revision,
      { aggregate: 'progress' },
    );
    expect((await kit.service.execute(userId, sent)).result).toBe('applied');
    expect((await kit.service.execute(userId, sent)).replayed).toBe(true);
    expect((await progress(userId, heroId)).state.knowledge).toMatchObject({
      current: 16,
      session: { lastAward: 6, earned: 6 },
    });
  });

  it('grants a battle reward once even when the same commandId is replayed after reload', async () => {
    const { userId, heroId } = await player();
    await placeHeroIn(world, userId, heroId, 'camping');
    const current = await progress(userId, heroId);
    const expeditionId = await ensureExpedition(kit.db, userId, heroId);
    const key = `srv-world:${current.state.presence!.mapId}`;
    const held = deserializeWorld(
      JSON.parse((await readServerDocument(kit.db, expeditionId, key))!),
      0,
    );
    held.battle = giveTurn(
      battleWith([hero({ q: 0, r: 0 }, { id: heroId }), skeleton('s1', { q: 1, r: 0 })]),
      [heroId, 's1'],
    );
    await kit.db.transaction((tx) =>
      writeServerDocument(tx, expeditionId, key, JSON.stringify(serializeWorld(held))),
    );
    const fixture = (await world.battleFixture(userId, heroId, { kind: 'saw-task' })) as {
      taskCorrectOption: number;
    };
    const sent = {
      commandId: randomUUID(),
      heroId,
      aggregate: 'progress',
      expectedRevision: current.revision,
      command: {
        type: 'WORLD_BATTLE',
        payload: {
          heroId,
          ...onHeldMap(
            'WORLD_BATTLE',
            { kind: 'hero', action: { kind: 'answer-task', option: fixture.taskCorrectOption } },
            current.state,
          ),
        },
      },
    };
    const answered = await world.execute(userId, sent);
    expect(answered.result).toBe('applied');
    expect(answered.events.filter((event) => event.type === 'WILL_GRANTED')).toHaveLength(1);
    world = new WorldService(kit.db, kit.heroes);
    expect((await world.execute(userId, sent)).replayed).toBe(true);
    expect((await progress(userId, heroId)).state.knowledge.current).toBe(14);
  });
});
