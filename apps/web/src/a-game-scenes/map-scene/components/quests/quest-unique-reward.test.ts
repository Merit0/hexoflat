import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, nextTick, type App } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { TOKEN_UNIQUES } from '@hexoflat/engine/content/token-uniques.content';
import { SPRITE_MANIFEST } from '@hexoflat/engine/tokens/sprite-manifest';
import { ALL_QUESTS } from '@hexoflat/engine/quests/all-quests';
import type { QuestDefinition } from '@hexoflat/engine/quests/quest-definition';
import type { Reward } from '@hexoflat/engine/quests/quest-definition';
import { i18n } from '@/i18n';
import { applyQuestProjection, resetQuestProjection } from '@/services/quests/quest-projection';
import { legacyQuestCard } from '@/services/quests/quest-card-content';
import { uniqueRewardPreview } from '@/services/quests/quest-unique-reward';
import { useQuestDetails } from '@/composables/use-quest-details';
import { generatedQuestBoard } from '@/test-support/generated-quest-board';
import { itemName } from '@/composables/shop-messages';
import { rewardText } from './quest-reward-text';
import QuestBoard from './quest-board.vue';

vi.mock('@/services/quests/quest-commands', () => ({
  acceptQuest: vi.fn(() => Promise.resolve({ ok: true })),
  claimQuest: vi.fn(() => Promise.resolve({ ok: true })),
  abandonQuest: vi.fn(() => Promise.resolve({ ok: true })),
  syncQuestBoard: vi.fn(() => Promise.resolve({ ok: true })),
  refreshQuestBoard: vi.fn(() => Promise.resolve({ ok: true })),
}));

const SWORD: Reward = { kind: 'item', itemKey: 'sword', amount: 1 };
const COINS: Reward = { kind: 'item', itemKey: 'coins', amount: 5 };
const board = generatedQuestBoard();
const wood = board.offers.find((offer) => offer.templateId === 'woodcutter')!;
const baseOffer = { ...wood, rewards: [SWORD, COINS] };
const uniqueOffer = { ...baseOffer, uniqueReward: 'lantern-eater' };
const startLocale = i18n.global.locale.value;
let app: App | null = null;
let host: HTMLElement;

async function openDetails(offer: typeof baseOffer): Promise<HTMLElement> {
  applyQuestProjection({ questBoard: { ...board, offers: [offer] } });
  const pinia = createPinia();
  setActivePinia(pinia);
  host = document.createElement('div');
  document.body.appendChild(host);
  app = createApp(QuestBoard).use(pinia).use(i18n);
  app.mount(host);
  host
    .querySelector(`[data-testid="quest-row-${offer.id}"]`)!
    .dispatchEvent(new MouseEvent('mouseenter'));
  await nextTick();
  return document.querySelector<HTMLElement>(`[data-testid="quest-details-${offer.id}"]`)!;
}

const textOf = (root: HTMLElement, testid: string) =>
  root.querySelector(`[data-testid="${testid}"]`)?.textContent?.trim();

describe('DA7-2: quest card with a unique reward', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en';
  });
  afterEach(() => {
    useQuestDetails().close();
    app?.unmount();
    host?.remove();
    app = null;
    resetQuestProjection();
    i18n.global.locale.value = startLocale;
  });

  it('shows the template name, the tier light, the authored range and the note', async () => {
    const details = await openDetails(uniqueOffer);
    const preview = details.querySelector<HTMLElement>('[data-testid="quest-unique-reward"]')!;
    expect(preview.querySelector('.name')?.textContent).toBe('Lantern-Eater');
    expect(preview.dataset.light).toBe('gloom-boss');
    expect(preview.style.getPropertyValue('--light')).toBe('#A855F7');
    expect(textOf(details, 'quest-unique-reward-heart')).toBe('Health: +0.5–1');
    expect(textOf(details, 'quest-unique-reward-note')).toBe('Attributes are rolled on turn-in.');
    const icon = details.querySelector<HTMLElement>('.item-icon')!.style.backgroundImage;
    expect(icon).toContain(SPRITE_MANIFEST.placeholder);
    expect(icon).toContain('violet-light.png');
  });

  it('follows the language', async () => {
    const details = await openDetails(uniqueOffer);
    i18n.global.locale.value = 'uk';
    await nextTick();
    expect(details.querySelector('[data-testid="quest-unique-reward"] .name')?.textContent).toBe(
      'Пожирач Ліхтарів',
    );
    expect(textOf(details, 'quest-unique-reward-note')).toBe(
      'Атрибути визначаються під час здачі квесту.',
    );
  });

  it('leaves a coin reward beside the unique as it was', async () => {
    const details = await openDetails(uniqueOffer);
    const pills = [...details.querySelectorAll<HTMLElement>('.pill')];
    expect(pills).toHaveLength(2);
    expect(pills[1].textContent?.trim()).toBe(rewardText(COINS));
  });

  it('a base reward card has no preview and the old text and icon', async () => {
    const details = await openDetails(baseOffer);
    expect(details.querySelector('[data-testid^="quest-unique-reward"]')).toBeNull();
    const pills = [...details.querySelectorAll<HTMLElement>('.pill')];
    expect(pills.map((pill) => pill.textContent?.trim())).toEqual([
      itemName('sword'),
      `5 × ${itemName('coins')}`,
    ]);
    expect(pills[0].querySelector<HTMLElement>('.item-icon')!.style.backgroundImage).not.toContain(
      'light.png',
    );
  });

  it('the claimed text and an older accepted quest name the unique', () => {
    expect(rewardText(SWORD, 'lantern-eater')).toBe('Lantern-Eater');
    expect(rewardText(SWORD)).toBe(itemName('sword'));
    const catalogue = ALL_QUESTS as Record<string, QuestDefinition>;
    const id = 'da7-unique';
    catalogue[id] = {
      ...ALL_QUESTS.woodcutter,
      id,
      rewardDropContext: { mapTier: 2, tier: 'unique', templateKey: 'lantern-eater' },
    };
    expect(legacyQuestCard(id)?.uniqueReward).toBe('lantern-eater');
    delete catalogue[id];
    expect(legacyQuestCard('woodcutter')).not.toHaveProperty('uniqueReward');
  });

  it.each(TOKEN_UNIQUES)('$key prints one range for each authored attribute', (unique) => {
    const preview = uniqueRewardPreview({ ...SWORD, itemKey: unique.type } as Reward, unique.key)!;
    expect(preview.ranges.map(({ key }) => key)).toEqual(
      unique.authoredAttributes.map(({ attribute }) => attribute),
    );
  });

  it('gives no preview for coins, another item type or an unknown template', () => {
    expect(uniqueRewardPreview(COINS, 'lantern-eater')).toBeNull();
    expect(uniqueRewardPreview({ ...SWORD, itemKey: 'shield' }, 'lantern-eater')).toBeNull();
    expect(uniqueRewardPreview(SWORD, 'nobody')).toBeNull();
    expect(uniqueRewardPreview(SWORD, undefined)).toBeNull();
  });
});
