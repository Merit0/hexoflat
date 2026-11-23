import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import type { ProgressState } from '@hexoflat/engine';
import { campObjectSpots } from '@hexoflat/engine/content/boards/camp-object-spot';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { createTestKit, envelope, type TestKit } from './player-test-kit';

const dbAvailable = inject('dbAvailable');
const [BOARD] = campObjectSpots(HEXOBJECT_KEYS.QUEST_BOARD);
const NEAR = getHexNeighbors(BOARD)[0];
const FAR = { columnIndex: BOARD.columnIndex + 2, rowIndex: BOARD.rowIndex };

describe.skipIf(!dbAvailable)('the quest board on the server (real Postgres)', () => {
  let kit: TestKit;
  beforeAll(() => {
    kit = createTestKit();
  });
  afterAll(async () => {
    await kit.close();
  });

  const progressOf = async (userId: string, heroId: string) =>
    (await kit.service.snapshot(userId, heroId)).aggregates.progress!;
  const questsOf = async (userId: string, heroId: string) =>
    ((await progressOf(userId, heroId)).state as ProgressState).quests;
  const dayOf = async (userId: string, heroId: string) =>
    ((await progressOf(userId, heroId)).state as ProgressState).day;

  async function heroAt(at: typeof NEAR) {
    const { userId, heroId } = await kit.newPlayer();
    const { revision } = await progressOf(userId, heroId);
    const arrive = envelope(
      heroId,
      'ARRIVE',
      { locationKey: 'camping', mapId: randomUUID(), coordinates: at },
      revision,
      { aggregate: 'progress' },
    );
    delete (arrive.command.payload as { revision?: number }).revision;
    expect((await kit.service.execute(userId, arrive)).result).toBe('applied');
    return { userId, heroId };
  }

  const accept = async (userId: string, heroId: string, extra = {}) => {
    const inventory = (await kit.service.snapshot(userId, heroId)).aggregates.inventory!;
    return envelope(heroId, 'QUEST_ACCEPT', { questId: 'woodcutter' }, inventory.revision, extra);
  };

  it('accepts beside the board and keeps the quest after a reload', async () => {
    const { userId, heroId } = await heroAt(NEAR);
    const answer = await kit.service.execute(userId, await accept(userId, heroId));
    expect(answer.result).toBe('applied');
    expect(answer.events.map((event) => event.type)).toContain('QUEST_ACCEPTED');
    expect((await questsOf(userId, heroId)).active).toEqual([
      { questId: 'woodcutter', progress: 0, state: 'active' },
    ]);
  });

  it('repeating the same commandId does not take the quest twice', async () => {
    const { userId, heroId } = await heroAt(NEAR);
    const command = await accept(userId, heroId, { commandId: randomUUID() });
    await kit.service.execute(userId, command);
    const replay = await kit.service.execute(userId, command);
    expect(replay.replayed).toBe(true);
    expect((await questsOf(userId, heroId)).active).toHaveLength(1);
  });

  it('refuses away from the board and changes nothing', async () => {
    const { userId, heroId } = await heroAt(FAR);
    const answer = await kit.service.execute(userId, await accept(userId, heroId));
    expect(answer.result).toBe('rejected');
    expect(answer.code).toBe('NOT_AT_BOARD');
    expect((await questsOf(userId, heroId)).active).toEqual([]);
  });

  it('rolls over on the first applied command after midnight and preserves taken quests', async () => {
    const midnight = Date.UTC(2026, 10, 24);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(midnight - 1);
    try {
      const { userId, heroId } = await heroAt(NEAR);
      const command = await accept(userId, heroId);
      expect((await kit.service.execute(userId, command)).result).toBe('applied');
      const previous = await dayOf(userId, heroId);
      clock.mockReturnValue(midnight);

      const replay = await kit.service.execute(userId, command);
      expect(replay.replayed).toBe(true);
      const revision = command.expectedRevision;
      const claim = envelope(heroId, 'QUEST_CLAIM', { questId: 'woodcutter' }, revision);
      expect(await kit.service.execute(userId, claim)).toMatchObject({ result: 'rejected' });
      expect(await dayOf(userId, heroId)).toEqual(previous);

      const take = envelope(heroId, 'QUEST_ACCEPT', { questId: 'stonebreaker' }, revision);
      const result = await kit.service.execute(userId, take);
      expect(result.events).toContainEqual({
        type: 'GAME_DAY_STARTED',
        payload: { heroId, dayId: 2, startedAt: midnight, reason: 'utc' },
      });
      expect(await dayOf(userId, heroId)).toMatchObject({ id: 2, willSpent: 5 });
      expect((await questsOf(userId, heroId)).active.map((quest) => quest.questId)).toEqual([
        'woodcutter',
        'stonebreaker',
      ]);
    } finally {
      clock.mockRestore();
    }
  });

  it('records one completion only after the reward claim succeeds', async () => {
    const { userId, heroId } = await heroAt(NEAR);
    await kit.service.questFixture(userId, heroId, {
      active: [{ questId: 'scholar', progress: 15, state: 'ready' }],
    });
    const inventory = (await kit.service.snapshot(userId, heroId)).aggregates.inventory!;
    const claim = envelope(heroId, 'QUEST_CLAIM', { questId: 'scholar' }, inventory.revision);
    expect((await dayOf(userId, heroId))?.questsCompleted).toBe(0);
    expect((await kit.service.execute(userId, claim)).result).toBe('applied');
    expect((await kit.service.execute(userId, claim)).replayed).toBe(true);
    expect((await dayOf(userId, heroId))?.questsCompleted).toBe(1);
  });
});
