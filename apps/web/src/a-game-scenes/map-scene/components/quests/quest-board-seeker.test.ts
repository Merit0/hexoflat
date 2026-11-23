import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { i18n } from '@/i18n';
import { useQuestDetails } from '@/composables/use-quest-details';
import { applyQuestProjection, resetQuestProjection } from '@/services/quests/quest-projection';
import { applyQuestRun, resetQuestRun } from '@/services/quests/quest-run-projection';
import { dismissQuestResult } from '@/services/quests/quest-result';
import { giveUpQuest } from '@/services/quests/quest-run-commands';
import { captureQuestResult } from '@/services/quests/quest-result';
import { generatedQuestBoard } from '@/test-support/generated-quest-board';
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
const board = generatedQuestBoard();
const seeker = board.offers.find(({ templateId }) => templateId === 'seeker-1')!;

describe('quest board: Treasure Seeker cards and run', () => {
  beforeEach(() => {
    applyQuestProjection({ questBoard: board });
    resetQuestRun();
    dismissQuestResult();
  });
  afterEach(() => {
    useQuestDetails().close();
    app?.unmount();
    host.remove();
    app = null;
    vi.clearAllMocks();
  });

  it('shows the four prices of card I in its rule and never a total', async () => {
    mount();
    byId(`quest-row-${seeker.id}`)!.dispatchEvent(new MouseEvent('mouseenter'));
    await nextTick();
    const rule = document.querySelector(
      `[data-testid="quest-details-${seeker.id}-rule"]`,
    )!.textContent;
    expect(rule).toContain(String(seeker.accept.kind === 'will' && seeker.accept.amount));
    expect(rule).toContain(String(seeker.expedition!.steps));
    expect(rule).toContain(String(seeker.expedition!.stepCost * seeker.expedition!.backMultiplier));
    expect(document.querySelector(`[data-testid="quest-chips-${seeker.id}"]`)).toBeNull();
    expect(byId(`quest-card-${seeker.id}`)!.textContent).not.toMatch(/total|усього|разом/i);
  });

  it('only shows Seeker offers in the server list', () => {
    mount();
    expect(byId('quest-card-seeker-2')).toBeNull();
    expect(byId(`quest-card-${seeker.id}`)).not.toBeNull();
  });

  it('disables START and says why when the Will is below the entry', async () => {
    mount();
    expect((byId(`quest-start-${seeker.id}`) as HTMLButtonElement).disabled).toBe(true);
    byId(`quest-row-${seeker.id}`)!.dispatchEvent(new MouseEvent('mouseenter'));
    await nextTick();
    expect(document.querySelector(`[data-testid="quest-short-${seeker.id}"]`)).not.toBeNull();
  });

  it('shows the run card with the trail row and asks before giving up', async () => {
    resetQuestProjection();
    applyQuestRun({
      offerId: seeker.id,
      offer: seeker,
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
    expect(host.querySelector('h3')?.textContent).toBe(i18n.global.t(seeker.nameKey));
    expect(byId('quest-run-details')?.textContent).toContain(
      i18n.global.t(seeker.tableRule, { target: seeker.goal.target }),
    );
    expect(byId('quest-trail-row')).not.toBeNull();
    byId('quest-give-up')!.click();
    await nextTick();
    expect(giveUpQuest).not.toHaveBeenCalled();
    byId('quest-give-up-confirm')!.click();
    await nextTick();
    expect(giveUpQuest).toHaveBeenCalledTimes(1);
  });

  it('keeps the generated title in the recap when the offer is no longer on the board', () => {
    resetQuestProjection();
    captureQuestResult([
      {
        type: 'QUEST_COMPLETED',
        payload: { questId: seeker.id, recap: { numbers: [], firstDeviation: null } },
      },
      { type: 'QUEST_SUMMARY', payload: { outcome: 'success', offer: seeker } },
    ]);
    mount();
    expect(host.querySelector('h3')?.textContent).toBe(i18n.global.t(seeker.nameKey));
    expect(byId('quest-board-refresh')).toBeNull();
  });
});
