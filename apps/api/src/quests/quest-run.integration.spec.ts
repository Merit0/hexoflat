import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { parseQuestRunDoc, type ProgressState } from '@hexoflat/engine';
import { campObjectSpots } from '@hexoflat/engine/content/boards/camp-object-spot';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { ensureExpedition, readServerDocument } from '../expedition/expedition-store';
import { WorldService } from '../world/world.service';
import { createTestKit, envelope, type TestKit } from '../player/player-test-kit';
import { QuestRunService } from './quest-run.service';

const dbAvailable = inject('dbAvailable');
const [BOARD] = campObjectSpots(HEXOBJECT_KEYS.QUEST_BOARD);
const NEAR = getHexNeighbors(BOARD)[0];
const FAR = { columnIndex: BOARD.columnIndex + 2, rowIndex: BOARD.rowIndex };

describe.skipIf(!dbAvailable)('the seeker run on the server (real Postgres)', () => {
  let kit: TestKit;
  let quests: QuestRunService;
  let world: WorldService;
  beforeAll(() => {
    kit = createTestKit();
    quests = new QuestRunService(kit.db, kit.heroes);
    world = new WorldService(kit.db, kit.heroes);
  });
  afterAll(async () => {
    await kit.close();
  });

  const progressOf = async (userId: string, heroId: string) =>
    (await kit.service.snapshot(userId, heroId)).aggregates.progress!;
  const stateOf = async (userId: string, heroId: string) =>
    (await progressOf(userId, heroId)).state as ProgressState;

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
    const inventory = (await kit.service.snapshot(userId, heroId)).aggregates.inventory!;
    const accept = envelope(heroId, 'QUEST_ACCEPT', { questId: 'seeker-1' }, inventory.revision);
    expect((await kit.service.execute(userId, accept)).result).toBe('applied');
    return { userId, heroId };
  }

  async function send(
    userId: string,
    heroId: string,
    type: string,
    payload: Record<string, unknown> = {},
    commandId?: string,
  ) {
    const { revision } = await progressOf(userId, heroId);
    const command = envelope(heroId, type, payload, revision, {
      aggregate: 'progress',
      ...(commandId ? { commandId } : {}),
    });
    delete (command.command.payload as { revision?: number }).revision;
    return quests.execute(userId, command);
  }

  const trailOf = async (userId: string, heroId: string) => {
    const expeditionId = await ensureExpedition(kit.db, userId, heroId);
    const raw = await readServerDocument(kit.db, expeditionId, 'srv-quest');
    return raw ? parseQuestRunDoc(raw).run.trail : null;
  };

  it('plays a quest to the real chest: entry paid, steps paid, milestone set, camp and card N+1 back', async () => {
    const { userId, heroId } = await heroAt(NEAR);
    const entered = await send(userId, heroId, 'QUEST_ENTER', { questId: 'seeker-1' });
    expect(entered.result).toBe('applied');
    expect(entered.quest).toMatchObject({ phase: 'walking' });
    expect((await stateOf(userId, heroId)).presence).toBeNull();

    const trail = (await trailOf(userId, heroId))!;
    for (const hex of trail) {
      expect((await send(userId, heroId, 'QUEST_STEP', { hex })).result).toBe('applied');
    }
    const before = await stateOf(userId, heroId);
    expect(before.knowledge.current).toBe(50 - 20 - 10);
    const opened = await send(userId, heroId, 'QUEST_OPEN_CHEST');
    expect(opened.quest).toMatchObject({ phase: 'collect' });
    const left = await send(userId, heroId, 'QUEST_RETURN');
    expect(left.result).toBe('applied');
    expect(left.quest).toBeNull();

    const after = await stateOf(userId, heroId);
    expect(after.quests.done['seeker-1']).toBe(1);
    expect(after.quests.active).toEqual([]);
    expect(after.presence).toMatchObject({ locationKey: 'camping' });
    expect(await trailOf(userId, heroId)).toBeNull();
  });

  it('REQ-QST-018 applies a repeated commandId once and refuses another account', async () => {
    const { userId, heroId } = await heroAt(NEAR);
    const entered = await send(userId, heroId, 'QUEST_ENTER', { questId: 'seeker-1' });
    const trail = (await trailOf(userId, heroId))!;
    const id = randomUUID();
    const first = await send(userId, heroId, 'QUEST_STEP', { hex: trail[0] }, id);
    const willAfter = (await stateOf(userId, heroId)).knowledge.current;
    const { revision } = await progressOf(userId, heroId);
    const again = envelope(heroId, 'QUEST_STEP', { hex: trail[0] }, revision - 1, {
      aggregate: 'progress',
      commandId: id,
    });
    delete (again.command.payload as { revision?: number }).revision;
    const replay = await quests.execute(userId, again);
    expect(replay.replayed).toBe(true);
    expect(first.result).toBe('applied');
    expect((await stateOf(userId, heroId)).knowledge.current).toBe(willAfter);
    expect(entered.result).toBe('applied');

    const stranger = await kit.newPlayer();
    const foreign = envelope(heroId, 'QUEST_STEP_BACK', {}, revision, { aggregate: 'progress' });
    delete (foreign.command.payload as { revision?: number }).revision;
    await expect(quests.execute(stranger.userId, foreign)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('REQ-QST-019 gives the same quest state after a reload, mid-walk and at the chest', async () => {
    const { userId, heroId } = await heroAt(NEAR);
    await send(userId, heroId, 'QUEST_ENTER', { questId: 'seeker-1' });
    const trail = (await trailOf(userId, heroId))!;
    let last = await send(userId, heroId, 'QUEST_STEP', { hex: trail[0] });
    last = await send(userId, heroId, 'QUEST_STEP', { hex: trail[1] });
    expect((await quests.snapshot(userId, heroId)).quest).toEqual(last.quest);
    for (const hex of trail.slice(2)) last = await send(userId, heroId, 'QUEST_STEP', { hex });
    expect(last.quest?.chest).not.toBeNull();
    expect((await quests.snapshot(userId, heroId)).quest).toEqual(last.quest);
    last = await send(userId, heroId, 'QUEST_OPEN_CHEST');
    expect((await quests.snapshot(userId, heroId)).quest).toEqual(last.quest);
  });

  it('refuses a second ENTER and keeps the world shut during a run', async () => {
    const { userId, heroId } = await heroAt(NEAR);
    const first = await send(userId, heroId, 'QUEST_ENTER', { questId: 'seeker-1' });
    expect(first.result).toBe('applied');
    const second = await send(userId, heroId, 'QUEST_ENTER', { questId: 'seeker-1' });
    expect(second).toMatchObject({ result: 'rejected', code: 'QUEST_IN_PROGRESS' });

    const { revision } = await progressOf(userId, heroId);
    const blocked = await world.execute(userId, {
      commandId: randomUUID(),
      heroId,
      aggregate: 'progress',
      expectedRevision: revision,
      command: { type: 'WORLD_ENTER', payload: { heroId, locationKey: 'camping' } },
    });
    expect(blocked).toMatchObject({ result: 'rejected', code: 'QUEST_OPEN' });

    const gone = await send(userId, heroId, 'QUEST_GIVE_UP');
    expect(gone.result).toBe('applied');
    expect((await stateOf(userId, heroId)).quests.active).toEqual([]);
  });

  it('refuses ENTER when the hero does not stand beside the board', async () => {
    const { userId, heroId } = await heroAt(NEAR);
    const { revision } = await progressOf(userId, heroId);
    const move = envelope(
      heroId,
      'ARRIVE',
      { locationKey: 'camping', mapId: randomUUID(), coordinates: FAR },
      revision,
      { aggregate: 'progress' },
    );
    delete (move.command.payload as { revision?: number }).revision;
    await kit.service.execute(userId, move);
    const refused = await send(userId, heroId, 'QUEST_ENTER', { questId: 'seeker-1' });
    expect(refused).toMatchObject({ result: 'rejected', code: 'NOT_AT_BOARD' });
  });
});
