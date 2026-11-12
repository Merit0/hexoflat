import { describe, expect, it } from 'vitest';
import { applyQuestEvents, planAccept } from './quest-log';
import { describeQuest, OBJECTIVES, type ObjectiveRegistry } from './objectives';
import type { QuestDefinition } from './quest-definition';
import { AT_BOARD, catalogueWith, counting, event, progressWith } from './quest-test-setup';

describe('objectives registry', () => {
  it('REQ-QB-009: a new count quest is only data and runs the full cycle', () => {
    const catalogue = catalogueWith(
      counting('moth-catcher', 'MOTH_CAUGHT', 3),
      counting('night-moth', 'MOTH_CAUGHT', 2, {
        objective: {
          kind: 'count',
          event: 'MOTH_CAUGHT',
          where: { night: true },
          target: 2,
          unitKey: 'quest.unit.moths',
        },
      }),
    );
    const ctx = { ...AT_BOARD, catalogue };
    let progress = progressWith(10);
    for (const id of ['moth-catcher', 'night-moth']) {
      const plan = planAccept(progress, undefined, id, ctx);
      if (!plan.ok) throw new Error(plan.reason);
      progress = plan.progress;
    }
    const stream = [
      event('MOTH_CAUGHT', { night: false }),
      event('MOTH_CAUGHT', { night: true }),
      event('MOTH_CAUGHT', { night: true }),
    ];
    const result = applyQuestEvents(progress, stream, catalogue);
    expect(result.progress.quests.active.map((entry) => [entry.progress, entry.state])).toEqual([
      [3, 'ready'],
      [2, 'ready'],
    ]);
    expect(result.events.map((e) => e.type)).toEqual(['QUEST_READY', 'QUEST_READY']);
  });

  it('REQ-QB-010: a new objective kind is one registry entry', () => {
    const registry: ObjectiveRegistry = {
      ...OBJECTIVES,
      reach: {
        onEvent: (_objective, progress, e) => (e.type === 'ARRIVED' ? 1 : progress),
        isComplete: (_objective, progress) => progress >= 1,
        describe: () => ({ unitKey: 'quest.unit.places', target: 1 }),
      },
    };
    const reach = {
      ...counting('scout-the-ridge', 'ARRIVED', 1),
      objective: { kind: 'reach' },
    } as unknown as QuestDefinition;
    const catalogue = catalogueWith(reach);
    const plan = planAccept(progressWith(0), undefined, reach.id, { ...AT_BOARD, catalogue });
    if (!plan.ok) throw new Error(plan.reason);
    const result = applyQuestEvents(plan.progress, [event('ARRIVED')], catalogue, registry);
    expect(result.progress.quests.active[0].state).toBe('ready');
    expect(describeQuest(reach, registry)).toEqual({ unitKey: 'quest.unit.places', target: 1 });
    expect(() => applyQuestEvents(plan.progress, [event('ARRIVED')], catalogue)).toThrow(
      'No objective handler for reach',
    );
  });

  it('describes a count quest for the card', () => {
    expect(describeQuest(counting('x', 'E', 7))).toEqual({
      unitKey: 'quest.unit.test',
      target: 7,
    });
  });
});
