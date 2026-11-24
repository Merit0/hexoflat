import { describe, expect, it } from 'vitest';
import { AGGREGATES, upcastAggregate } from '../aggregates/registry';
import { emptyProgressState } from '../aggregates/progress-state';
import { DEFAULT_DROP_CONTEXT } from '../tokens/drop-context';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { EDimension } from '../dimensions/dimensions';
import { questDimension } from './quest-definition';
import { generateQuestOffers } from './quest-generator';
import { questOfferSchema, type QuestOffer } from './quest-offer';
import { parseQuestRun } from './quest-state';
import { enterQuest } from './seeker-actions';
import { discBoard, seekerProgress } from './seeker-test-setup';
import { ALL_QUESTS } from './all-quests';

const HERO = 'hero';
const CAVE = { tokenType: ETokenType.GLOOM, mapTier: 3 } as const;

function offersOf(rngSeed: string): QuestOffer[] {
  return generateQuestOffers({
    heroId: HERO,
    rngSeed,
    dayId: 1,
    issuedToday: 0,
    count: 7,
    log: { active: [], done: {} },
    locationDropContexts: {
      camping: DEFAULT_DROP_CONTEXT,
      silesia: DEFAULT_DROP_CONTEXT,
      'silesia-north': DEFAULT_DROP_CONTEXT,
      cave: CAVE,
    },
  });
}

function preDa5a2(offer: QuestOffer, name: 'tokenType' | 'realm' = 'tokenType') {
  const { rewardDropContext, ...definition } = offer.definition;
  const dimension = questDimension(offer.definition);
  const tokenType = dimension === EDimension.EARTH ? ETokenType.IDOL : ETokenType.GLOOM;
  return {
    ...offer,
    definition: {
      ...definition,
      dimension,
      ...(rewardDropContext
        ? { rewardDropContext: { [name]: tokenType, ...rewardDropContext } }
        : {}),
    },
  };
}

describe('saved quest offers written before DA5a-2', () => {
  const offers = offersOf('da5a2-offers');

  it('writes new offers without a dimension and with only a tier', () => {
    expect(offers).toHaveLength(7);
    const contexts = offers.flatMap(({ definition }) => definition.rewardDropContext ?? []);
    expect(contexts.length).toBeGreaterThan(0);
    for (const context of contexts) expect(Object.keys(context)).toEqual(['mapTier']);
    expect(contexts).toContainEqual({ mapTier: 3 });
    for (const { definition } of offers) expect(definition).not.toHaveProperty('dimension');
  });

  it.each(['tokenType', 'realm'] as const)(
    'drops only definition.dimension and rewardDropContext.%s',
    (name) => {
      for (const offer of offers) {
        const old = preDa5a2(offer, name);
        const before = structuredClone(old);
        expect(questOfferSchema.parse(old)).toEqual(offer);
        expect(old).toEqual(before);
      }
    },
  );

  it('still refuses any other unknown field', () => {
    const old = preDa5a2(offers[0]);
    expect(questOfferSchema.safeParse({ ...old, extra: 1 }).success).toBe(false);
    expect(
      questOfferSchema.safeParse({ ...old, definition: { ...old.definition, extra: 1 } }).success,
    ).toBe(false);
    expect(questOfferSchema.safeParse({ ...old, definition: null }).success).toBe(false);
  });

  it('reads them in progress v12 and in a saved quest run', () => {
    const current = { ...emptyProgressState(HERO), quests: { active: [], done: {}, offers } };
    const v12 = {
      ...current,
      ownedUniques: ['lantern-eater'],
      quests: { ...current.quests, offers: offers.map((offer) => preDa5a2(offer)) },
    };
    expect(upcastAggregate('progress', 12, v12, { heroId: HERO })).toEqual(
      AGGREGATES.progress.schema.parse(current),
    );

    const board = discBoard();
    const entered = enterQuest(seekerProgress('seeker-1'), {
      questId: 'seeker-1',
      catalogue: ALL_QUESTS,
      seed: 'da5a2-run',
      board,
      start: board.start,
      atBoard: true,
      hasRun: false,
    });
    if (!entered.ok) throw new Error('enter refused');
    const run = { ...entered.run, generatedOffer: offers[0] };
    const stored = { ...run, generatedOffer: preDa5a2(offers[0]) };
    expect(parseQuestRun(JSON.parse(JSON.stringify(stored)))).toEqual(
      parseQuestRun(JSON.parse(JSON.stringify(run))),
    );
    expect(parseQuestRun(JSON.parse(JSON.stringify(stored))).generatedOffer).toEqual(offers[0]);
  });
});
