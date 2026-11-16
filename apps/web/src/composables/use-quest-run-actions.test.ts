import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { i18n } from '@/i18n';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { pickUpQuestLoot, returnFromQuest } from '@/services/quests/quest-run-commands';
import { useQuestRunActions } from './use-quest-run-actions';
import type { QuestProjection } from '@hexoflat/engine/quests/projection';
import { applyQuestRun, resetQuestRun } from '@/services/quests/quest-run-projection';
import { inventorySession } from '@/services/inventory/inventory-session';
import { refetchServedWorld } from '@/services/world/served-world';
import { routeToLocation } from '@/services/world/location-navigator';
import { useWorldMapStore } from '@/stores/world-map-store';

vi.mock('@/services/quests/quest-run-commands', () => ({
  giveUpQuest: vi.fn(),
  pauseQuest: vi.fn(),
  openQuestChest: vi.fn(),
  pickUpQuestLoot: vi.fn(),
  returnFromQuest: vi.fn(),
  startSeekerQuest: vi.fn(),
  stepQuest: vi.fn(),
  stepQuestBack: vi.fn(),
}));

vi.mock('@/services/world/served-world', () => ({ refetchServedWorld: vi.fn() }));
vi.mock('@/services/world/location-navigator', () => ({ routeToLocation: vi.fn() }));

describe('quest pickup warnings', () => {
  beforeEach(() => setActivePinia(createPinia()));
  it.each(['OVERWEIGHT', 'BAG_FULL'])(
    'shows %s in the shared banner without hiding the hand',
    async (reason) => {
      vi.mocked(pickUpQuestLoot).mockResolvedValue({ ok: false, reason });
      const tool = useHeroToolStore();
      tool.useTool('hand', { columnIndex: 1, rowIndex: 1 });
      const actions = useQuestRunActions();
      expect(await actions.pickUp({ columnIndex: 2, rowIndex: 1 })).toBe(false);
      const key = reason === 'OVERWEIGHT' ? 'loot.reject.OVERWEIGHT' : 'quest.refusal.BAG_FULL';
      expect(tool.actionMessage).toBe(i18n.global.t(key));
      expect(tool.actionMessageTone).toBe('warn');
      expect(tool.isDragging).toBe(true);
      expect(actions.message.value).toBeNull();
    },
  );
});

describe('leaving the quest field', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetQuestRun();
  });

  it('goes to the place the server put the hero', async () => {
    applyQuestRun({ phase: 'collect' } as QuestProjection);
    inventorySession.presence = {
      locationKey: 'silesia',
      mapId: 'silesia-map',
      coordinates: { columnIndex: 4, rowIndex: 4 },
    };
    vi.mocked(returnFromQuest).mockImplementation(() => {
      applyQuestRun(null);
      return Promise.resolve({ ok: true });
    });
    const go = vi.spyOn(useWorldMapStore(), 'goToLocation').mockImplementation(() => undefined);
    expect(await useQuestRunActions().returnToCamp()).toBe(true);
    expect(refetchServedWorld).toHaveBeenCalledWith('silesia');
    expect(go).toHaveBeenCalledWith('silesia');
    expect(routeToLocation).toHaveBeenCalledWith('silesia');
  });
});
