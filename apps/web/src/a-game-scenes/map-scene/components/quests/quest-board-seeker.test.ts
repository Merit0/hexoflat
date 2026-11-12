import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { i18n } from '@/i18n';
import { resetQuestProjection } from '@/services/quests/quest-projection';
import { applyQuestRun, resetQuestRun } from '@/services/quests/quest-run-projection';
import { dismissQuestResult } from '@/services/quests/quest-result';
import { giveUpQuest } from '@/services/quests/quest-run-commands';
import QuestBoard from './quest-board.vue';

vi.mock('@/services/quests/quest-run-commands', () => ({
  startSeekerQuest: vi.fn(() => Promise.resolve({ ok: true })),
  stepQuest: vi.fn(),
  stepQuestBack: vi.fn(),
  openQuestChest: vi.fn(),
  returnFromQuest: vi.fn(),
  giveUpQuest: vi.fn(() => Promise.resolve({ ok: true })),
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

describe('quest board: Treasure Seeker cards and run', () => {
  beforeEach(() => {
    resetQuestProjection();
    resetQuestRun();
    dismissQuestResult();
  });
  afterEach(() => {
    app?.unmount();
    host.remove();
    app = null;
    vi.clearAllMocks();
  });

  it('shows the four chips of card I and never a total', () => {
    mount();
    const chips = byId('quest-chips-seeker-1')!.textContent;
    expect(chips).toContain('20');
    expect(chips).toContain('10');
    expect(chips).toContain('3');
    expect(byId('quest-card-seeker-1')!.textContent).not.toMatch(/total|усього|разом/i);
  });

  it('locks card II behind card I with a reason and no START', () => {
    mount();
    expect(byId('quest-card-seeker-2')!.dataset.state).toBe('locked');
    expect(byId('quest-start-seeker-2')).toBeNull();
    expect(byId('quest-card-seeker-2')!.textContent).toContain('First Trail');
  });

  it('disables START and says why when the Will is below the entry', () => {
    mount();
    expect((byId('quest-start-seeker-1') as HTMLButtonElement).disabled).toBe(true);
    expect(byId('quest-short-seeker-1')).not.toBeNull();
  });

  it('shows the run card with the trail row and asks before giving up', async () => {
    applyQuestRun({
      offerId: 'seeker-1',
      phase: 'walking',
      outcome: null,
      start: { columnIndex: 12, rowIndex: 12 },
      position: { columnIndex: 12, rowIndex: 12 },
      path: [],
      opened: [],
      hintHex: null,
      chest: null,
      stepCost: 1,
      backCost: 3,
    });
    mount();
    await nextTick();
    expect(byId('quest-run-card')).not.toBeNull();
    expect(byId('quest-trail-row')).not.toBeNull();
    byId('quest-give-up')!.click();
    await nextTick();
    expect(giveUpQuest).not.toHaveBeenCalled();
    byId('quest-give-up-confirm')!.click();
    await nextTick();
    expect(giveUpQuest).toHaveBeenCalledTimes(1);
  });
});
