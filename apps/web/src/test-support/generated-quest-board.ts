import { projectQuestOffer } from '@hexoflat/engine/quests/quest-board-projection';
import { generateQuestOffers } from '@hexoflat/engine/quests/quest-generator';
import { ERarityKind } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { DEFAULT_TOKEN_ORIGIN } from '@hexoflat/engine/tokens/token-origin';

export function generatedQuestBoard(dayId = 1) {
  const offers = generateQuestOffers({
    heroId: 'hero',
    rngSeed: 'web-tests',
    dayId,
    issuedToday: 0,
    count: 7,
    log: { active: [], done: {} },
    locationOrigins: {
      camping: DEFAULT_TOKEN_ORIGIN,
      silesia: DEFAULT_TOKEN_ORIGIN,
      cave: { realm: ERarityKind.GLOOM, mapTier: 3 },
    },
  });
  return { dayId, refreshPrice: 50, remaining: null, offers: offers.map(projectQuestOffer) };
}
