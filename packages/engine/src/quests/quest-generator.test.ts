import { describe, expect, it } from 'vitest';
import { emptyProgressState } from '../aggregates/progress-state';
import { AGGREGATES, upcastAggregate } from '../aggregates/registry';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { DEFAULT_DROP_CONTEXT } from '../tokens/drop-context';
import { deriveStream } from '../utils/random-seeded';
import { ALL_QUESTS } from './all-quests';
import { describeQuest } from './objectives';
import { QUEST_GENERATION_PROFILES } from './quest-generation.content';
import { rollQuestReward } from './quest-generation-rewards';
import { generateQuestOffers, type QuestGenerationInput } from './quest-generator';
import { applyQuestEvents } from './quest-log';
import { questDefinitionFor } from './quest-lookup';
import { questOfferSchema } from './quest-offer';
import { seekerFieldView } from './cloned-field';
import { enterQuest } from './seeker-actions';
import { generatedEntrance } from './seeker-entrance-setup';
import { counting, event } from './quest-test-setup';
import { questSellValue } from './quests.content';
import { questGenerationFailures } from './validate-quest-generation';

const earth = DEFAULT_DROP_CONTEXT;
const cave = { tokenType: ETokenType.GLOOM, mapTier: 3 } as const;
const input: QuestGenerationInput = {
  heroId: 'hero',
  rngSeed: 'private-hero-seed',
  dayId: 3,
  issuedToday: 0,
  count: 7,
  log: { active: [], done: {} },
  locationDropContexts: { camping: earth, silesia: earth, 'silesia-north': earth, cave },
};
const wood = QUEST_GENERATION_PROFILES.find((profile) => profile.templateId === 'woodcutter')!;

describe('generated quest offers', () => {
  it('validates authored profiles for every template and identifies bad profiles', () => {
    expect(questGenerationFailures()).toEqual([]);
    const invalid = {
      ...wood,
      variants: [wood.variants[0], { ...wood.variants[0], reward: undefined }],
    };
    expect(questGenerationFailures([...QUEST_GENERATION_PROFILES, invalid])).toEqual(
      expect.arrayContaining([
        'woodcutter: duplicate generation profile',
        'woodcutter: duplicate target 7',
        'woodcutter: evening-kindling needs a board reward',
      ]),
    );
  });

  it('replays identically independent of content order and keeps secrets out of the offer', () => {
    const first = generateQuestOffers(input);
    expect(first).toHaveLength(7);
    expect(new Set(first.map(({ id }) => id)).size).toBe(7);
    expect(first.map(({ serial }) => serial)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(JSON.stringify(first)).not.toContain(input.rngSeed);
    const profiles = [...QUEST_GENERATION_PROFILES].reverse().map((profile) => ({
      ...profile,
      variants: [...profile.variants].reverse(),
    }));
    expect(generateQuestOffers(input, { profiles })).toEqual(first);
    for (const changed of [{ heroId: 'other' }, { dayId: 4 }, { issuedToday: 7 }]) {
      expect(generateQuestOffers({ ...input, ...changed })[0].id).not.toBe(first[0].id);
    }
  });

  it('prefers different categories while keeping locked levels and completed milestones out', () => {
    const starting = generateQuestOffers({ ...input, count: 4 });
    expect(starting.map(({ templateId }) => templateId)).toEqual(
      expect.arrayContaining(['bone-hunter', 'scholar', 'seeker-1']),
    );
    expect(starting.filter(({ templateId }) => templateId === 'bone-hunter')).toHaveLength(1);
    const active = [
      {
        questId: 'bone-hunter',
        state: 'active' as const,
        progress: 1,
      },
    ];
    const progressed = generateQuestOffers({
      ...input,
      log: { active, done: { 'seeker-1': 1, 'bone-hunter': 1 } },
    });
    expect(progressed.some(({ templateId }) => templateId === 'bone-hunter')).toBe(false);
    expect(progressed.some(({ templateId }) => templateId === 'seeker-3')).toBe(false);
    const seekerProfiles = QUEST_GENERATION_PROFILES.filter(({ templateId }) =>
      templateId.startsWith('seeker-'),
    );
    const seeker = generateQuestOffers(
      { ...input, log: { active: [], done: { 'seeker-1': 1, 'seeker-2': 1 } } },
      { profiles: seekerProfiles },
    );
    expect(seeker.map(({ templateId }) => templateId).sort()).toEqual([
      'seeker-1',
      'seeker-1',
      'seeker-2',
      'seeker-2',
      'seeker-3',
      'seeker-3',
    ]);
    expect(
      generateQuestOffers(
        { ...input, log: { active, done: {} } },
        {
          profiles: QUEST_GENERATION_PROFILES.filter(
            ({ templateId }) => templateId === 'bone-hunter',
          ),
        },
      ),
    ).toEqual([]);
  });

  it('considers reachable locations, remaining board slots and recent goals', () => {
    expect(generateQuestOffers({ ...input, locationDropContexts: { cave: earth } })).toEqual([]);
    const options = { profiles: [wood] };
    const first = generateQuestOffers({ ...input, count: 1 }, options)[0];
    const second = generateQuestOffers(
      { ...input, count: 1, issuedToday: 1, recentOffers: [first] },
      options,
    )[0];
    expect(second.variantId).not.toBe(first.variantId);
    const log = { ...input.log, offers: generateQuestOffers({ ...input, count: 6 }) };
    expect(generateQuestOffers({ ...input, issuedToday: 6, log })).toHaveLength(1);
    const northOnly = generateQuestOffers({
      ...input,
      locationDropContexts: { 'silesia-north': earth },
    });
    expect(northOnly.length).toBeGreaterThan(0);
    for (const offer of northOnly) expect(offer.definition.locations).toEqual(['silesia-north']);
  });

  it('fills a category with distinct templates before repeating one', () => {
    for (let seed = 0; seed < 30; seed++) {
      const offers = generateQuestOffers({
        ...input,
        rngSeed: `pilot:${seed}`,
        log: { active: [], done: { scholar: 1, 'seeker-1': 1 } },
      });
      expect(offers.map(({ templateId }) => templateId)).toEqual(
        expect.arrayContaining([
          'woodcutter',
          'stonebreaker',
          'scholar',
          'camp-lectern',
          'seeker-1',
          'seeker-2',
        ]),
      );
    }
  });
});

describe('the camp lectern pilot', () => {
  it('unlocks the shipped pilot after Scholar and counts correct answers through the existing objective', () => {
    expect(generateQuestOffers(input).some(({ templateId }) => templateId === 'camp-lectern')).toBe(
      false,
    );
    const log = { active: [], done: { scholar: 1 } };
    const offer = generateQuestOffers({ ...input, log }).find(
      ({ templateId }) => templateId === 'camp-lectern',
    )!;
    const target = describeQuest(offer.definition).target;
    const progress = {
      ...emptyProgressState(input.heroId),
      quests: {
        ...log,
        active: [{ questId: offer.id, state: 'active' as const, progress: 0 }],
        offers: [offer],
      },
    };
    const correct = event('HALL_ANSWERED', { correct: true });
    const incorrect = event('HALL_ANSWERED', { correct: false });
    const events = Array.from({ length: target }, () => correct);
    expect(applyQuestEvents(progress, [incorrect], ALL_QUESTS, undefined, 'camping').progress).toBe(
      progress,
    );
    expect(applyQuestEvents(progress, events, ALL_QUESTS, undefined, 'silesia').progress).toBe(
      progress,
    );
    expect(
      applyQuestEvents(progress, [incorrect, ...events], ALL_QUESTS, undefined, 'camping').progress
        .quests.active,
    ).toEqual([{ questId: offer.id, progress: target, state: 'ready' }]);
  });
});

describe('generated quest rewards', () => {
  it('rolls different amounts, potions and base items within the authored reward budget', () => {
    const rewardKinds = new Set<string>();
    const amounts = new Set<number>();
    for (let seed = 0; seed < 120; seed++) {
      const offers = generateQuestOffers(
        { ...input, rngSeed: `seed:${seed}` },
        { profiles: [wood] },
      );
      expect(
        offers.map(({ definition }) => describeQuest(definition).target).sort((a, b) => a - b),
      ).toEqual([7, 12, 15]);
      for (const { definition } of offers) {
        expect(questSellValue(definition)).toBeLessThanOrEqual(definition.maxSellValue!);
        for (const reward of definition.rewards) {
          if (reward.kind !== 'item') continue;
          amounts.add(reward.amount);
          if (reward.token) expect(reward.token.baseKey).toMatch(/^earth-/);
          rewardKinds.add(reward.token ? 'base' : reward.itemKey);
        }
      }
    }
    expect(rewardKinds).toEqual(new Set(['coins', 'health-bottle', 'base']));
    expect(amounts.size).toBeGreaterThan(3);
    const [hunter] = generateQuestOffers({ ...input, locationDropContexts: { cave } });
    expect(hunter.definition.rewards[0]).toMatchObject({
      itemKey: HEXOBJECT_KEYS.SHIELD,
      amount: 1,
      token: { baseKey: 'underworld-shield', mapTier: 3 },
    });
  });

  it('falls back to coins when the actual equipment sale price exceeds the limit', () => {
    const seed = 'price-fallback';
    const reward = rollQuestReward(
      {
        maxSellValue: 1,
        fallbackCoins: 1,
        entries: [{ itemKey: 'axe', weight: 1, amount: [1, 1] }],
      },
      deriveStream(seed, 'reward'),
      { seed, sourceId: 'quest:fallback', dropContext: earth },
    );
    expect(reward).toEqual({ kind: 'item', itemKey: 'coins', amount: 1 });
  });
});

describe('generated quest execution and persistence', () => {
  it('loads old active quests and round trips the exact generated definition by offer ID', () => {
    const empty = emptyProgressState(input.heroId);
    const active = { questId: 'woodcutter', state: 'active' as const, progress: 0 };
    const old = upcastAggregate(
      'progress',
      11,
      { ...empty, quests: { active: [active], done: {} } },
      { heroId: input.heroId },
    );
    expect(questDefinitionFor(old.quests, active.questId)).toBe(ALL_QUESTS.woodcutter);
    const offer = generateQuestOffers(input, { profiles: [wood] }).find(
      ({ variantId }) => variantId === 'evening-kindling',
    )!;
    const stored = {
      ...old,
      quests: { active: [{ ...active, questId: offer.id }], done: {}, offers: [offer] },
    };
    const restored = upcastAggregate(
      'progress',
      AGGREGATES.progress.schemaVersion,
      JSON.parse(JSON.stringify(stored)),
      { heroId: input.heroId },
    );
    expect(questDefinitionFor(restored.quests, offer.id)).toEqual(offer.definition);
    const events = Array.from({ length: 7 }, () => event('RESOURCE_GATHERED', { action: 'CUT' }));
    const advanced = applyQuestEvents(restored, events, ALL_QUESTS, undefined, 'silesia');
    expect(advanced.progress.quests.active).toEqual([
      { questId: offer.id, state: 'ready', progress: 7 },
    ]);
    expect(
      AGGREGATES.progress.schema.safeParse({
        ...stored,
        quests: { ...stored.quests, offers: [offer, offer] },
      }).success,
    ).toBe(false);
    expect(questOfferSchema.safeParse({ ...offer, templateId: 'scholar' }).success).toBe(false);
  });

  it('generates an additional count template through its definition and profile', () => {
    const template = counting('trail-watch', 'WORLD_STEPPED', 4);
    const catalogue = { [template.id]: template };
    const profiles = [{ ...wood, templateId: template.id }];
    expect(questGenerationFailures(profiles, catalogue)).toEqual([]);
    const offers = generateQuestOffers({ ...input, count: 2 }, { catalogue, profiles });
    expect(offers).toHaveLength(2);
    for (const offer of offers) {
      expect(offer.templateId).toBe(template.id);
      expect(offer.definition.objective).toMatchObject({ kind: 'count', event: 'WORLD_STEPPED' });
    }
  });

  it('builds trails for every generated Seeker variant with its saved length and loot table', () => {
    const offers = generateQuestOffers(
      {
        ...input,
        locationDropContexts: { silesia: earth },
        log: { active: [], done: { 'seeker-1': 1, 'seeker-2': 1 } },
      },
      { profiles: QUEST_GENERATION_PROFILES.filter(({ category }) => category === 'exp') },
    );
    expect(offers).toHaveLength(6);
    for (const offer of offers) {
      const objective = offer.definition.objective;
      if (objective.kind !== 'expedition') throw new Error('expected expedition');
      const progress = emptyProgressState(input.heroId);
      progress.quests = {
        ...progress.quests,
        offers: [offer],
        active: [{ questId: offer.id, state: 'active', progress: 0 }],
      };
      for (let i = 0; i < 40; i++) {
        const seed = `offer-field:${i}`;
        const { field, start } = generatedEntrance(seed);
        const result = enterQuest(progress, {
          questId: offer.id,
          catalogue: { [offer.id]: offer.definition },
          board: seekerFieldView(field),
          field,
          start,
          seed,
          atBoard: true,
          hasRun: false,
        });
        expect(result.ok, `${offer.variantId}, seed ${i}`).toBe(true);
        if (!result.ok) continue;
        expect(result.run.trail).toHaveLength(objective.params.steps);
        expect(result.run.chestLootTableId).toBe(objective.params.chestLootTableId);
      }
    }
  });
});
