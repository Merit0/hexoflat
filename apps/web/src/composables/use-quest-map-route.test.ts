import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick } from 'vue';
import type { QuestProjection } from '@hexoflat/engine/quests/projection';
import router, { ROUTES } from '@/router';
import { questRun } from '@/services/quests/quest-run-projection';
import { closeKnowledgePanel } from './use-knowledge-panel';
import { useQuestMapRoute } from './use-quest-map-route';

const { replace } = vi.hoisted(() => ({ replace: vi.fn().mockResolvedValue(undefined) }));

vi.mock('@/router', async () => {
  const { shallowRef } = await import('vue');
  return {
    ROUTES: { WORLD: 'world', QUEST_MAP: 'quest-map' },
    default: {
      currentRoute: shallowRef({ name: 'world' }),
      replace,
    },
  };
});
vi.mock('./use-knowledge-panel', () => ({ closeKnowledgePanel: vi.fn() }));

describe('quest map route synchronization', () => {
  let scope: ReturnType<typeof effectScope>;

  beforeEach(() => {
    vi.clearAllMocks();
    questRun.value = null;
    router.currentRoute.value = { name: ROUTES.WORLD } as typeof router.currentRoute.value;
    scope = effectScope();
  });

  afterEach(() => scope.stop());

  function start() {
    scope.run(() => useQuestMapRoute(() => 'silesia'));
  }

  it('moves an active run to its quest URL and closes the quest board', async () => {
    start();
    questRun.value = { phase: 'walking' } as QuestProjection;
    await nextTick();
    expect(closeKnowledgePanel).toHaveBeenCalledWith(false);
    expect(replace).toHaveBeenCalledExactlyOnceWith({ name: ROUTES.QUEST_MAP });
  });

  it('restores an active run at the quest URL without replacing that route', () => {
    router.currentRoute.value = { name: ROUTES.QUEST_MAP } as typeof router.currentRoute.value;
    questRun.value = { phase: 'walking' } as QuestProjection;
    start();
    expect(closeKnowledgePanel).toHaveBeenCalledWith(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it('falls back to the origin map when a quest URL has no active run', () => {
    router.currentRoute.value = { name: ROUTES.QUEST_MAP } as typeof router.currentRoute.value;
    start();
    expect(replace).toHaveBeenCalledExactlyOnceWith({
      name: ROUTES.WORLD,
      params: { locationKey: 'silesia' },
    });
  });

  it('leaves the quest URL when the run is suspended or ended', async () => {
    router.currentRoute.value = { name: ROUTES.QUEST_MAP } as typeof router.currentRoute.value;
    questRun.value = { phase: 'walking' } as QuestProjection;
    start();
    questRun.value = null;
    await nextTick();
    expect(replace).toHaveBeenCalledWith({
      name: ROUTES.WORLD,
      params: { locationKey: 'silesia' },
    });
  });
});
