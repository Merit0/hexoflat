import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { i18n } from '@/i18n';
import { applyQuestProjection, resetQuestProjection } from '@/services/quests/quest-projection';
import { acceptQuest, claimQuest } from '@/services/quests/quest-commands';
import { useQuestActions } from '@/composables/use-quest-actions';
import { useQuestDetails } from '@/composables/use-quest-details';
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
    useQuestDetails().close();
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

  it('shows progress of a taken quest with a drop button and no claim before it is ready', async () => {
    applyQuestProjection({
      quests: { active: [{ questId: 'woodcutter', progress: 3, state: 'active' }], done: {} },
    });
    mount();
    expect(byId('quest-progress-woodcutter')!.textContent?.trim()).toBe('3 / 10');
    byId('quest-row-woodcutter')!.dispatchEvent(new MouseEvent('mouseenter'));
    await nextTick();
    expect(document.querySelector('[data-testid="quest-abandon-woodcutter"]')).not.toBeNull();
    expect(byId('quest-claim-woodcutter')).toBeNull();
    expect(byId('quest-accept-woodcutter')).toBeNull();
  });

  it('swaps the progress counter for Return on hover and back on leave', async () => {
    applyQuestProjection({
      quests: { active: [{ questId: 'woodcutter', progress: 3, state: 'active' }], done: {} },
    });
    mount();
    const counter = () => byId('quest-progress-woodcutter')!;
    counter().dispatchEvent(new MouseEvent('mouseenter'));
    await nextTick();
    expect(counter().textContent?.trim()).toBe('Return');
    counter().dispatchEvent(new MouseEvent('mouseleave'));
    await nextTick();
    expect(counter().textContent?.trim()).toBe('3 / 10');
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

describe('quest board layout and details', () => {
  beforeEach(() => {
    resetQuestProjection();
    useQuestActions().clearMessage();
  });
  afterEach(() => {
    useQuestDetails().close();
    app?.unmount();
    host.remove();
    app = null;
    vi.clearAllMocks();
  });

  it('groups quests into my quests, on the board and shows the slot line', () => {
    applyQuestProjection({
      quests: { active: [{ questId: 'woodcutter', progress: 1, state: 'active' }], done: {} },
    });
    mount();
    expect(
      byId('quest-group-active')!.querySelector('[data-testid="quest-card-woodcutter"]'),
    ).not.toBeNull();
    expect(
      byId('quest-group-available')!.querySelector('[data-testid="quest-card-stonebreaker"]'),
    ).not.toBeNull();
    expect(byId('quest-slots')!.textContent).toContain('1 / 3');
  });

  it('puts only the price on the take button, never the word Take', () => {
    mount();
    const button = byId('quest-accept-bone-hunter')!;
    expect(button.textContent?.trim()).toBe('5');
    expect(button.getAttribute('aria-label')).toContain('5');
  });

  it('paints the price red while the hero has too little Will', () => {
    mount();
    expect(byId('quest-price-bone-hunter')!.classList.contains('is-short')).toBe(true);
  });

  it('opens the details on hover only and closes them after the pointer leaves', async () => {
    vi.useFakeTimers();
    mount();
    byId('quest-row-woodcutter')!.click();
    await nextTick();
    expect(document.querySelector('[data-testid="quest-details-woodcutter"]')).toBeNull();
    byId('quest-row-woodcutter')!.dispatchEvent(new MouseEvent('mouseenter'));
    await nextTick();
    expect(document.querySelector('[data-testid="quest-details-woodcutter"]')).not.toBeNull();
    byId('quest-row-woodcutter')!.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(200);
    await nextTick();
    expect(document.querySelector('[data-testid="quest-details-woodcutter"]')).toBeNull();
    vi.useRealTimers();
  });

  it('never prints a raw translation key', () => {
    mount();
    expect(host.textContent).not.toMatch(/\bquest\.[a-z-]+\.[A-Za-z.-]+/);
  });
});
