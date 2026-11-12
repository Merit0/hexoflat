import { describe, expect, it } from 'vitest';
import { foldQuestEvents } from './quest-hook';
import { event, progressWith } from './quest-test-setup';

describe('foldQuestEvents', () => {
  it('advances an active quest and appends QUEST_READY at the target', () => {
    const progress = progressWith(0);
    progress.quests.active.push({ questId: 'woodcutter', progress: 9, state: 'active' });
    const result = foldQuestEvents({
      progress,
      events: [event('RESOURCE_GATHERED', { action: 'CUT', hexobjectKey: 'tree', amount: 1 })],
    });
    expect(result.progress.quests.active[0]).toMatchObject({ progress: 10, state: 'ready' });
    expect(result.events.map((e) => e.type)).toEqual(['RESOURCE_GATHERED', 'QUEST_READY']);
  });

  it('returns the same object when no quest is active', () => {
    const input = {
      progress: progressWith(0),
      events: [event('RESOURCE_GATHERED', { action: 'CUT' })],
    };
    expect(foldQuestEvents(input)).toBe(input);
  });
});
