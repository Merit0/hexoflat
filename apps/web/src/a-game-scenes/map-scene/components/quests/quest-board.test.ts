import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { i18n } from '@/i18n';
import { applyQuestProjection, resetQuestProjection } from '@/services/quests/quest-projection';
import { acceptQuest, claimQuest } from '@/services/quests/quest-commands';
import { useQuestActions } from '@/composables/use-quest-actions';
import QuestBoard from './quest-board.vue';

vi.mock('@/services/quests/quest-commands', () => ({
  acceptQuest: vi.fn(() => Promise.resolve({ ok: true })),
  claimQuest: vi.fn(() => Promise.resolve({ ok: false, reason: 'NOT_AT_BOARD' })),
  abandonQuest: vi.fn(() => Promise.resolve({ ok: true })),
}));

let app: App | null = null;
let host: HTMLElement;

function mount() {
  const pinia = createPinia();
  setActivePinia(pinia);
  host = document.createElement('div');
  document.body.appendChild(host);
  app = createApp(QuestBoard).use(pinia).use(i18n);
  app.mount(host);
}

const byId = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe('quest board panel', () => {
  beforeEach(() => {
    resetQuestProjection();
    useQuestActions().clearMessage();
  });
  afterEach(() => {
    app?.unmount();
    host.remove();
    app = null;
    vi.clearAllMocks();
  });

  it('lists the board quests and sends ACCEPT for the chosen card', async () => {
    mount();
    expect(byId('quest-card-woodcutter')).not.toBeNull();
    byId('quest-accept-woodcutter')!.click();
    await nextTick();
    expect(acceptQuest).toHaveBeenCalledWith('woodcutter');
  });

  it('shows progress of a taken quest with a drop button and no claim before it is ready', () => {
    applyQuestProjection({
      quests: { active: [{ questId: 'woodcutter', progress: 3, state: 'active' }], done: {} },
    });
    mount();
    expect(byId('quest-progress-woodcutter')!.textContent?.trim()).toBe('3 / 10');
    expect(byId('quest-abandon-woodcutter')).not.toBeNull();
    expect(byId('quest-claim-woodcutter')).toBeNull();
    expect(byId('quest-accept-woodcutter')).toBeNull();
  });

  it('marks a finished quest and explains a refused claim', async () => {
    applyQuestProjection({
      quests: { active: [{ questId: 'woodcutter', progress: 10, state: 'ready' }], done: {} },
    });
    mount();
    expect(byId('quest-tracked-woodcutter')!.dataset.ready).toBe('true');
    byId('quest-claim-woodcutter')!.click();
    await vi.waitFor(() => expect(byId('quest-message')).not.toBeNull());
    expect(claimQuest).toHaveBeenCalledWith('woodcutter');
    expect(byId('quest-message')!.textContent).toContain(
      i18n.global.t('quest.refusal.NOT_AT_BOARD'),
    );
  });

  it('hides a finished one-time quest from the board', () => {
    applyQuestProjection({ quests: { active: [], done: { 'bone-hunter': 1 } } });
    mount();
    expect(byId('quest-card-bone-hunter')).toBeNull();
    expect(byId('quest-card-woodcutter')).not.toBeNull();
  });
});
