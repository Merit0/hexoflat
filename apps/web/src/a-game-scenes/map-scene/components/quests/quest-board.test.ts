import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { mintBaseToken, tokenSourceIdOf } from '@hexoflat/engine/tokens/game-tokens';
import { DEFAULT_DROP_CONTEXT } from '@hexoflat/engine/tokens/drop-context';
import { i18n } from '@/i18n';
import { applyQuestProjection, resetQuestProjection } from '@/services/quests/quest-projection';
import {
  acceptQuest,
  claimQuest,
  refreshQuestBoard,
  syncQuestBoard,
} from '@/services/quests/quest-commands';
import { useQuestActions } from '@/composables/use-quest-actions';
import { useQuestDetails } from '@/composables/use-quest-details';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { tokenSpriteUrl } from '@/render/token-look';
import { tokenName } from '@/services/tokens/token-text';
import { generatedQuestBoard } from '@/test-support/generated-quest-board';
import QuestBoard from './quest-board.vue';

vi.mock('@/services/quests/quest-commands', () => ({
  acceptQuest: vi.fn(() => Promise.resolve({ ok: true })),
  claimQuest: vi.fn(() => Promise.resolve({ ok: false, reason: 'NOT_AT_BOARD' })),
  abandonQuest: vi.fn(() => Promise.resolve({ ok: true })),
  syncQuestBoard: vi.fn(() => Promise.resolve({ ok: true })),
  refreshQuestBoard: vi.fn(() => Promise.resolve({ ok: true })),
}));

const board = generatedQuestBoard();
const wood = board.offers.find((offer) => offer.templateId === 'woodcutter')!;
const stone = board.offers.find((offer) => offer.templateId === 'stonebreaker')!;
const bone = board.offers.find((offer) => offer.templateId === 'bone-hunter')!;
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
    applyQuestProjection({ questBoard: board });
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
    expect(byId(`quest-card-${wood.id}`)?.textContent).toContain(i18n.global.t(wood.nameKey));
    byId(`quest-accept-${wood.id}`)!.click();
    await nextTick();
    expect(acceptQuest).toHaveBeenCalledWith(wood.id);
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

  it('shows no authored offers before initial sync', () => {
    resetQuestProjection();
    mount();
    expect(byId('quest-group-available')!.querySelector('li')).toBeNull();
    expect(syncQuestBoard).toHaveBeenCalledTimes(1);
  });

  it('uses the generated target in progress and sends CLAIM for the instance', async () => {
    applyQuestProjection({
      quests: {
        active: [{ questId: wood.id, progress: wood.goal.target, state: 'ready' }],
        done: {},
      },
      questBoard: board,
    });
    mount();
    expect(byId(`quest-tracked-${wood.id}`)?.dataset.ready).toBe('true');
    byId(`quest-row-${wood.id}`)!.dispatchEvent(new MouseEvent('mouseenter'));
    await nextTick();
    expect(
      document.querySelector(`[data-testid="quest-details-${wood.id}"]`)?.textContent,
    ).toContain(`${wood.goal.target} / ${wood.goal.target}`);
    byId(`quest-claim-${wood.id}`)!.click();
    await vi.waitFor(() => expect(claimQuest).toHaveBeenCalledWith(wood.id));
  });

  it('uses the displayed day and price, then displays the next quote from the server', async () => {
    vi.mocked(refreshQuestBoard).mockImplementationOnce(() => {
      applyQuestProjection({ questBoard: { ...board, refreshPrice: 75 } });
      return Promise.resolve({ ok: true });
    });
    mount();
    const button = byId('quest-board-refresh') as HTMLButtonElement;
    await vi.waitFor(() => expect(button.disabled).toBe(false));
    button.click();
    button.click();
    await nextTick();
    expect(refreshQuestBoard).toHaveBeenCalledExactlyOnceWith({
      dayId: board.dayId,
      refreshPrice: 50,
    });
    await vi.waitFor(() => expect(button.getAttribute('aria-label')).toContain('75'));
    expect(useHeroToolStore().actionMessageWillCost).toBe(50);
  });

  it('recovers a stale quote with free sync and never retries the paid command', async () => {
    vi.mocked(refreshQuestBoard).mockResolvedValueOnce({ ok: false, reason: 'QUEST_BOARD_STALE' });
    mount();
    const button = byId('quest-board-refresh') as HTMLButtonElement;
    await vi.waitFor(() => expect(button.disabled).toBe(false));
    button.click();
    await vi.waitFor(() => expect(syncQuestBoard).toHaveBeenCalledTimes(2));
    expect(refreshQuestBoard).toHaveBeenCalledTimes(1);
    expect(useHeroToolStore().actionMessage).toBe(i18n.global.t('quest.refusal.QUEST_BOARD_STALE'));
  });

  it('syncs an open board on rollover and shows the server reset price', async () => {
    applyQuestProjection({ questBoard: { ...board, refreshPrice: 75 } });
    mount();
    await vi.waitFor(() =>
      expect((byId('quest-board-refresh') as HTMLButtonElement).disabled).toBe(false),
    );
    const next = generatedQuestBoard(board.dayId + 1);
    applyQuestProjection({ questBoard: next });
    await nextTick();
    expect(syncQuestBoard).toHaveBeenCalledTimes(2);
    expect(byId('quest-board-refresh')?.getAttribute('aria-label')).toContain('50');
    expect(byId(`quest-card-${wood.id}`)).toBeNull();
  });
});

describe('quest board layout and details', () => {
  beforeEach(() => {
    applyQuestProjection({ questBoard: board });
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
      questBoard: {
        ...board,
        offers: board.offers.filter(({ templateId }) => templateId !== 'woodcutter'),
      },
    });
    mount();
    expect(
      byId('quest-group-active')!.querySelector('[data-testid="quest-card-woodcutter"]'),
    ).not.toBeNull();
    expect(
      byId('quest-group-available')!.querySelector(`[data-testid="quest-card-${stone.id}"]`),
    ).not.toBeNull();
    expect(byId('quest-slots')!.textContent).toContain('1 / 3');
  });

  it('puts only the price on the take button, never the word Take', () => {
    mount();
    const button = byId(`quest-accept-${bone.id}`)!;
    expect(button.textContent?.trim()).toBe('5');
    expect(button.getAttribute('aria-label')).toContain('5');
  });

  it('paints the price red while the hero has too little Will', () => {
    mount();
    expect(byId(`quest-price-${bone.id}`)!.classList.contains('is-short')).toBe(true);
  });

  it('shows the projected equipment name and sprite on the reward', async () => {
    const itemKey = HEXOBJECT_KEYS.AXE;
    const token = mintBaseToken(
      {
        seed: 'quest-reward',
        sourceId: tokenSourceIdOf('quest', wood.id),
        dropContext: DEFAULT_DROP_CONTEXT,
      },
      itemKey,
      0,
    );
    applyQuestProjection({
      questBoard: {
        ...board,
        offers: [{ ...wood, rewards: [{ kind: 'item', itemKey, amount: 1, token }] }],
      },
    });
    mount();
    byId(`quest-row-${wood.id}`)!.dispatchEvent(new MouseEvent('mouseenter'));
    await nextTick();
    const details = document.querySelector(`[data-testid="quest-details-${wood.id}"]`);
    expect(details?.textContent).toContain(tokenName(token));
    expect(details?.querySelector<HTMLElement>('.item-icon')?.style.backgroundImage).toContain(
      tokenSpriteUrl(token),
    );
  });

  it.each([
    ['an EARTH location', wood, 'dimensions.earth'],
    ['an UNDERWORLD location', bone, 'dimensions.underworld'],
    ['a moved quest', { ...wood, locations: ['cave' as const] }, 'dimensions.underworld'],
  ])('shows the dimension of %s in the details', async (_case, offer, dimensionKey) => {
    expect(offer).not.toHaveProperty('dimension');
    applyQuestProjection({ questBoard: { ...board, offers: [offer] } });
    mount();
    byId(`quest-row-${offer.id}`)!.dispatchEvent(new MouseEvent('mouseenter'));
    await nextTick();
    const label = document.querySelector(`[data-testid="quest-details-${offer.id}"] .dimension`);
    expect(label?.textContent).toBe(
      i18n.global.t('dimensions.label', { name: i18n.global.t(dimensionKey) }),
    );
  });

  it('shows the location dimension of a quest accepted in an older save', async () => {
    applyQuestProjection({
      quests: { active: [{ questId: 'bone-hunter', progress: 0, state: 'active' }], done: {} },
    });
    mount();
    byId('quest-row-bone-hunter')!.dispatchEvent(new MouseEvent('mouseenter'));
    await nextTick();
    expect(
      document.querySelector('[data-testid="quest-details-bone-hunter"] .dimension')?.textContent,
    ).toBe(i18n.global.t('dimensions.label', { name: i18n.global.t('dimensions.underworld') }));
  });

  it('opens the details on hover only and closes them after the pointer leaves', async () => {
    vi.useFakeTimers();
    mount();
    const row = byId(`quest-row-${wood.id}`)!;
    const details = () => document.querySelector(`[data-testid="quest-details-${wood.id}"]`);
    row.click();
    await nextTick();
    expect(details()).toBeNull();
    row.dispatchEvent(new MouseEvent('mouseenter'));
    await nextTick();
    expect(details()?.textContent).toContain(
      i18n.global.t(wood.tableRule, { target: wood.goal.target }),
    );
    row.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(200);
    await nextTick();
    expect(details()).toBeNull();
    vi.useRealTimers();
  });

  it('never prints a raw translation key', () => {
    mount();
    expect(host.textContent).not.toMatch(/\bquest\.[a-z-]+\.[A-Za-z.-]+/);
  });
});
