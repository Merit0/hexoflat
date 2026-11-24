import { projectQuestOffer } from '@hexoflat/engine/quests/quest-board-projection';
import { generateQuestOffers } from '@hexoflat/engine/quests/quest-generator';
import { ETokenType } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { DEFAULT_DROP_CONTEXT } from '@hexoflat/engine/tokens/drop-context';

export function generatedQuestBoard(dayId = 1) {
  const offers = generateQuestOffers({
    heroId: 'hero',
    rngSeed: 'web-tests',
    dayId,
    issuedToday: 0,
    count: 7,
    log: { active: [], done: {} },
    locationDropContexts: {
      camping: DEFAULT_DROP_CONTEXT,
      silesia: DEFAULT_DROP_CONTEXT,
      cave: { tokenType: ETokenType.GLOOM, mapTier: 3 },
    },
  });
  return { dayId, refreshPrice: 50, remaining: null, offers: offers.map(projectQuestOffer) };
}
