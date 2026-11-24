import { dimensionOfTokenType } from '../dimensions/dimensions';
import { LOCATION_DIMENSIONS, type LocationKey } from '../registry/location-key';
import { tokenSourceIdOf } from '../tokens/game-tokens';
import type { DropContext } from '../tokens/drop-context';
import { sha256Hex } from '../utils/hash/sha256';
import { pickRandom, type RandomNumberGenerator } from '../utils/random';
import { deriveStream } from '../utils/random-seeded';
import { ALL_QUESTS } from './all-quests';
import {
  uniqueRewardKey,
  type Objective,
  type QuestCatalogue,
  type QuestDefinition,
} from './quest-definition';
import {
  QUEST_GENERATION_PROFILES,
  QUEST_GENERATOR_VERSION,
  questOfferTextKeys,
  type QuestGenerationProfile,
  type QuestGenerationVariant,
} from './quest-generation.content';
import { rollQuestReward } from './quest-generation-rewards';
import { unmetRequirements } from './quest-log';
import type { QuestLog } from './quest-log-state';
import { questDefinitionFor } from './quest-lookup';
import { QUEST_BOARD_SIZE, questOfferSchema, type QuestOffer } from './quest-offer';

export interface QuestGenerationInput {
  heroId: string;
  rngSeed: string;
  dayId: number;
  issuedToday: number;
  count: number;
  log: QuestLog;
  /** Trusted drop context for each reachable location. */
  locationDropContexts: Readonly<Partial<Record<LocationKey, DropContext>>>;
  recentOffers?: readonly QuestOffer[];
}

interface Candidate {
  profile: QuestGenerationProfile;
  variant: QuestGenerationVariant;
  definition: QuestDefinition;
  dropContext: DropContext;
}

function goalKey(quest: QuestDefinition): string {
  const target =
    quest.objective.kind === 'count' ? quest.objective.target : quest.objective.params.steps;
  return JSON.stringify([quest.id, target, [...quest.locations].sort()]);
}

function withTarget(objective: Objective, target: number): Objective {
  return objective.kind === 'count'
    ? { ...objective, target }
    : { ...objective, params: { ...objective.params, steps: target } };
}

function compareId(a: string, b: string): number {
  return a < b ? -1 : Number(a > b);
}

function candidatesFor(
  input: QuestGenerationInput,
  occupied: readonly QuestDefinition[],
  catalogue: QuestCatalogue,
  profiles: readonly QuestGenerationProfile[],
): Candidate[] {
  const usedGoals = new Set(occupied.map(goalKey));
  return [...profiles]
    .sort((a, b) => compareId(a.templateId, b.templateId))
    .flatMap((profile) => {
      const template = catalogue[profile.templateId];
      if (!template || unmetRequirements(input.log, template)) return [];
      if (
        template.repeat === 'once' &&
        (input.log.done[template.id] || occupied.some(({ id }) => id === template.id))
      )
        return [];

      const locations = template.locations.filter((location) => {
        const dropContext = input.locationDropContexts[location];
        return (
          dropContext &&
          dimensionOfTokenType(dropContext.tokenType) === LOCATION_DIMENSIONS[location]
        );
      });
      const placement = template.mapObjectPlacement;
      if (locations.length === 0 || (placement && !locations.includes(placement.targetMap)))
        return [];
      const sourceLocation = placement?.targetMap ?? locations[0];
      const dropContext: DropContext = {
        ...input.locationDropContexts[sourceLocation]!,
        ...(template.rewardDropContext ? { mapTier: template.rewardDropContext.mapTier } : {}),
      };

      return [...profile.variants]
        .sort((a, b) => compareId(a.id, b.id))
        .flatMap((variant) => {
          const definition = {
            ...template,
            locations,
            objective: withTarget(template.objective, variant.target),
          };
          return usedGoals.has(goalKey(definition))
            ? []
            : [{ profile, variant, definition, dropContext }];
        });
    });
}

function chooseCandidate(
  pool: Candidate[],
  usedCategories: ReadonlyMap<string, number>,
  representedTemplates: ReadonlySet<string>,
  recentGoals: ReadonlySet<string>,
  random: (label: string) => RandomNumberGenerator,
): Candidate {
  const categoryCount = (candidate: Candidate) =>
    usedCategories.get(candidate.profile.category) ?? 0;
  const minimum = Math.min(...pool.map(categoryCount));
  const diverse = pool.filter((candidate) => categoryCount(candidate) === minimum);
  const unrepresented = diverse.filter(
    ({ definition }) => !representedTemplates.has(definition.id),
  );
  const preferred = unrepresented.length ? unrepresented : diverse;
  const fresh = preferred.filter(({ definition }) => !recentGoals.has(goalKey(definition)));
  const eligible = fresh.length ? fresh : preferred;
  const templateIds = [...new Set(eligible.map(({ profile }) => profile.templateId))];
  const templateId = pickRandom(templateIds, random('template'));
  return pickRandom(
    eligible.filter(({ profile }) => profile.templateId === templateId),
    random('target'),
  )!;
}

function materialize(
  input: QuestGenerationInput,
  serial: number,
  label: string,
  candidate: Candidate,
): QuestOffer {
  const { profile, variant, definition, dropContext } = candidate;
  const id = `qo-${sha256Hex(JSON.stringify([input.rngSeed, label])).slice(0, 32)}`;
  const { howKey, ...text } = questOfferTextKeys(profile.templateId, variant.id);
  const generated: QuestDefinition = { ...definition, ...text };
  if (variant.reward && !uniqueRewardKey(definition)) {
    const random = deriveStream(input.rngSeed, `${label}:reward`);
    generated.rewardDropContext = { mapTier: dropContext.mapTier };
    generated.rewards = [
      rollQuestReward(variant.reward, random, {
        seed: input.rngSeed,
        sourceId: tokenSourceIdOf('quest', id),
        dropContext,
      }),
    ];
    generated.maxSellValue = variant.reward.maxSellValue;
  }
  return questOfferSchema.parse({
    id,
    templateId: profile.templateId,
    variantId: variant.id,
    generationVersion: QUEST_GENERATOR_VERSION,
    dayId: input.dayId,
    serial,
    definition: generated,
    howKey,
  });
}

/** Plans additions to the board. The caller persists the result and advances the issue count. */
export function generateQuestOffers(
  input: QuestGenerationInput,
  {
    catalogue = ALL_QUESTS,
    profiles = QUEST_GENERATION_PROFILES,
  }: {
    catalogue?: QuestCatalogue;
    profiles?: readonly QuestGenerationProfile[];
  } = {},
): QuestOffer[] {
  const saved = input.log.offers ?? [];
  const occupiedIds = new Set([
    ...saved.map(({ id }) => id),
    ...input.log.active.map(({ questId }) => questId),
  ]);
  const occupied = [...occupiedIds].flatMap(
    (id) => questDefinitionFor(input.log, id, catalogue) ?? [],
  );
  const recentGoals = new Set(input.recentOffers?.map(({ definition }) => goalKey(definition)));
  const representedTemplates = new Set(occupied.map(({ id }) => id));
  const usedCategories = new Map<string, number>();
  const categoryByTemplate = new Map(
    profiles.map(({ templateId, category }) => [templateId, category]),
  );
  for (const { id } of occupied) {
    const category = categoryByTemplate.get(id);
    if (category) usedCategories.set(category, (usedCategories.get(category) ?? 0) + 1);
  }

  const capacity = Math.min(Math.floor(input.count), QUEST_BOARD_SIZE - occupiedIds.size);
  let pool = candidatesFor(input, occupied, catalogue, profiles);
  const offers: QuestOffer[] = [];
  while (offers.length < capacity && pool.length > 0) {
    const serial = input.issuedToday + offers.length + 1;
    const label = JSON.stringify([input.heroId, input.dayId, serial, QUEST_GENERATOR_VERSION]);
    const random = (part: string) => deriveStream(input.rngSeed, `${label}:${part}`);
    const selected = chooseCandidate(
      pool,
      usedCategories,
      representedTemplates,
      recentGoals,
      random,
    );
    offers.push(materialize(input, serial, label, selected));
    const { definition, profile } = selected;
    representedTemplates.add(definition.id);
    usedCategories.set(profile.category, (usedCategories.get(profile.category) ?? 0) + 1);
    pool = pool.filter((candidate) =>
      definition.repeat === 'once'
        ? candidate.definition.id !== definition.id
        : goalKey(candidate.definition) !== goalKey(definition),
    );
  }
  return offers;
}
