import { describe, expect, it } from 'vitest';
import { emptyProgressState } from '../aggregates/progress-state';
import { executePlayerCommand } from '../aggregates/execute-player-command';
import type { PlayerAggregates } from '../aggregates/execute-player-command';
import type { PlayerCommand } from '../aggregates/player-commands';
import { emptyInventoryState } from '../inventory/inventory-state';
import { CAMP_BOOK_HEX } from './camp-book';
import { getHexNeighbors } from '../utils/hex-utils';
import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { upcastToken } from '../inventory/upcast-item-tokens';
import { resolveHeroStats } from '../tokens/equipment/hero-stats';
import { EQUIPMENT_ATTRIBUTES } from '../content/equipment-attributes.content';
import { EQUIPMENT_TYPES } from '../content/item-types.content';
import { grantEquipmentTaskWill } from './equipment-task-will';

function run(
  state: PlayerAggregates,
  action: Extract<PlayerCommand, { type: 'KNOWLEDGE' }>['payload']['action'],
) {
  const result = executePlayerCommand(
    state,
    {
      type: 'KNOWLEDGE',
      payload: { heroId: 'hero', revision: state.progress.knowledge.revision, action },
    },
    { devGrantAllowed: false, inventory: { stashOpen: false, battleOpen: false } },
  );
  return { result, state: result.ok ? { ...state, ...result.changed } : state };
}

function hall() {
  const state = { inventory: emptyInventoryState('hero'), progress: emptyProgressState('hero') };
  state.progress.presence = {
    locationKey: 'camping',
    mapId: 'camp',
    coordinates: getHexNeighbors(CAMP_BOOK_HEX)[0],
  };
  state.progress.knowledge.current = 10;
  return run(state, { kind: 'start', mode: 'hall', seed: 'wisdom' }).state;
}

function answer(state: PlayerAggregates, correct = true, elapsedMs = 500) {
  const session = state.progress.knowledge.session!;
  return run(state, {
    kind: 'answer',
    sessionId: session.id,
    questionId: session.question.id,
    answer: correct
      ? session.question.answer
      : session.question.options.find((value) => value !== session.question.answer)!,
    elapsedMs,
  });
}

function wisdom(state: PlayerAggregates, value: number, equipped = true) {
  const item = {
    id: 'hero:wisdom',
    key: 'shield' as const,
    type: EHexobjectGroup.EQUIPMENT,
    amount: 1,
    token: { ...upcastToken('hero', 'wisdom', 'shield')!, attributes: [{ key: 'wisdom', value }] },
  };
  if (equipped) state.inventory.equip.shield = item;
  else state.inventory.bag[0] = item;
  return state;
}

describe('Hall rewards before equipment bonuses', () => {
  it('grants two Will for a fast answer, one for a slow answer and none for a mistake', () => {
    expect(answer(hall()).state.progress.knowledge.current).toBe(12);
    expect(answer(hall(), true, 5000).state.progress.knowledge.current).toBe(11);
    expect(answer(hall(), false).state.progress.knowledge.current).toBe(10);
  });

  it('refuses a second answer to the same question without another reward', () => {
    const first = answer(hall()).state;
    const repeated = answer(first);
    expect(repeated.result.ok).toBe(false);
    expect(repeated.state).toEqual(first);
  });
});

describe('A05 Wisdom Hall rewards', () => {
  it('marks quick answers by elapsed time rather than the equipment reward amount', () => {
    expect(answer(wisdom(hall(), 4), true, 5000).state.progress.knowledge.session).toMatchObject({
      lastAward: 5,
      lastFast: false,
    });
    expect(answer(wisdom(hall(), 4)).state.progress.knowledge.session).toMatchObject({
      lastAward: 6,
      lastFast: true,
    });
  });

  it('does not grant the hero Will for somebody else’s correct task answer', () => {
    const state = wisdom(hall(), 4);
    expect(
      grantEquipmentTaskWill(state.progress.knowledge, state.inventory, [
        {
          type: 'TASK_RESOLVED',
          payload: { creatureId: 'enemy', taskId: 'task-1', correct: true },
        },
      ]),
    ).toEqual([]);
    expect(state.progress.knowledge.current).toBe(10);
  });
  it.each([1, 2, 3, 4, 5])('adds +%s to both fast and slow correct answers', (bonus) => {
    expect(answer(wisdom(hall(), bonus)).state.progress.knowledge.current).toBe(12 + bonus);
    expect(answer(wisdom(hall(), bonus), true, 5000).state.progress.knowledge.current).toBe(
      11 + bonus,
    );
  });

  it('ignores bag items and wrong answers; removing equipment restores the base reward', () => {
    expect(answer(wisdom(hall(), 4, false)).state.progress.knowledge.current).toBe(12);
    expect(answer(wisdom(hall(), 4), false).state.progress.knowledge.current).toBe(10);
    const state = wisdom(hall(), 4);
    state.inventory.equip.shield = null;
    expect(answer(state).state.progress.knowledge.current).toBe(12);
  });

  it('caps the sum at five and clamps the actual grant to Will capacity', () => {
    const state = wisdom(hall(), 4);
    state.inventory.equip.weapon = { ...state.inventory.equip.shield!, id: 'hero:other' };
    expect(answer(state).state.progress.knowledge.current).toBe(17);
    state.progress.knowledge.current = 49;
    expect(answer(state).state.progress.knowledge).toMatchObject({
      current: 50,
      session: { lastAward: 1, earned: 1 },
    });
  });

  it('never grants twice for the same correct answer', () => {
    const first = answer(wisdom(hall(), 5)).state;
    const again = answer(first);
    expect(again.result.ok).toBe(false);
    expect(again.state.progress.knowledge.current).toBe(17);
  });

  it('continues to resolve deprecated owned Wisdom attributes', () => {
    const state = wisdom(hall(), 4);
    const attributes = EQUIPMENT_ATTRIBUTES.map((entry) =>
      entry.key === 'wisdom' ? { ...entry, deprecated: true } : entry,
    );
    expect(
      resolveHeroStats(Object.values(state.inventory.equip), { attributes, types: EQUIPMENT_TYPES })
        .answerWillReward,
    ).toBe(4);
  });
});
