import { describe, expect, it } from 'vitest';
import { EDimension } from '../dimensions/dimensions';
import { LOCATION_DIMENSIONS } from '../registry/location-key';
import { ALL_QUESTS } from './all-quests';
import { QuestDefinitionSchema, questDimension } from './quest-definition';
import { applyQuestEvents, planClaim } from './quest-log';
import { event, inventoryWith, progressWith, AT_BOARD } from './quest-test-setup';
import { createServerWorld, serializeWorld } from '../world/server-world';
import { installQuestEntrances } from './world-entrances';
import { enterQuest } from './seeker-actions';
import { cloneWorldField } from './cloned-field';
import { discBoard, seekerProgress } from './seeker-test-setup';
import { questDropContext } from './quest-drop-context';
import { parseQuestRun } from './quest-state';

describe('quest run source', () => {
  it('captures the authored source for new expeditions even without a copied field', () => {
    const board = discBoard();
    const quest = {
      ...ALL_QUESTS['seeker-1'],
      locations: ['cave' as const],
      mapObjectPlacement: undefined,
    };
    const result = enterQuest(seekerProgress('seeker-1'), {
      questId: 'seeker-1',
      catalogue: { 'seeker-1': quest },
      seed: 'scope',
      board,
      start: board.start,
      atBoard: true,
      hasRun: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const saved = parseQuestRun(JSON.parse(JSON.stringify(result.run)));
      expect(saved.dropContext).toEqual({ tokenType: 'gloom', mapTier: 1 });
      expect(questDropContext(saved).tokenType).toBe('gloom');
    }
  });
});

describe('quest execution dimensions', () => {
  it('requires one dimension and existing execution locations on every quest', () => {
    for (const quest of Object.values(ALL_QUESTS)) {
      expect(QuestDefinitionSchema.safeParse(quest).success).toBe(true);
      expect(quest.locations.length).toBeGreaterThan(0);
      for (const location of quest.locations)
        expect(LOCATION_DIMENSIONS[location]).toBe(questDimension(quest));
      expect(QuestDefinitionSchema.safeParse({ ...quest, locations: [] }).success).toBe(false);
      expect(
        QuestDefinitionSchema.safeParse({ ...quest, locations: ['silesia', 'cave'] }).success,
      ).toBe(false);
    }
    expect(ALL_QUESTS['bone-hunter'].locations).toEqual(['cave']);
    expect(questDimension(ALL_QUESTS['bone-hunter'])).toBe(EDimension.UNDERWORLD);
  });

  it('counts gathering where it happened, independently of the resource owner', () => {
    const progress = progressWith(50);
    progress.quests.active = [{ questId: 'stonebreaker', progress: 0, state: 'active' }];
    const mine = { action: 'MINE', hexobjectKey: 'rock', amount: 10 };
    const foreign = event('RESOURCE_GATHERED', { ...mine, dimension: EDimension.UNDERWORLD });
    expect(applyQuestEvents(progress, [foreign], ALL_QUESTS).progress).toBe(progress);
    expect(
      applyQuestEvents(progress, [{ type: 'RESOURCE_GATHERED', payload: mine }], ALL_QUESTS)
        .progress,
    ).toBe(progress);
    const local = applyQuestEvents(progress, [event('RESOURCE_GATHERED', mine)], ALL_QUESTS);
    expect(local.progress.quests.active[0].progress).toBe(1);
  });

  it('only Underworld kills advance the dungeon quest', () => {
    const progress = progressWith(50);
    progress.quests.active = [{ questId: 'bone-hunter', progress: 0, state: 'active' }];
    const victory = { outcome: 'victory', kills: 3 };
    expect(applyQuestEvents(progress, [event('BATTLE_CLOSED', victory)], ALL_QUESTS).progress).toBe(
      progress,
    );
    const result = applyQuestEvents(
      progress,
      [
        event('BATTLE_CLOSED', {
          ...victory,
          dimension: EDimension.UNDERWORLD,
        }),
      ],
      ALL_QUESTS,
    );
    expect(result.progress.quests.active[0]).toMatchObject({ progress: 3, state: 'ready' });
  });

  it('claims the dungeon shield from the Underworld base pool at the Earth board', () => {
    const progress = progressWith(50);
    progress.quests.active = [{ questId: 'bone-hunter', progress: 3, state: 'ready' }];
    const result = planClaim(progress, inventoryWith({}), 'bone-hunter', AT_BOARD);
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.inventory?.bag.find((item) => item?.key === 'shield')?.token).toMatchObject({
        dimension: EDimension.UNDERWORLD,
        tokenType: 'gloom',
        baseKey: 'underworld-shield',
      });
  });

  it('rejects placing an Earth quest entrance in the dungeon before changing the world', () => {
    const world = createServerWorld('cave', 'cave-quest', 'scope', 'hero');
    const progress = seekerProgress('seeker-1');
    const quest = {
      ...ALL_QUESTS['seeker-1'],
      mapObjectPlacement: {
        ...ALL_QUESTS['seeker-1'].mapObjectPlacement!,
        targetMap: 'cave' as const,
      },
    };
    const before = serializeWorld(world);
    expect(() => installQuestEntrances(world, progress, { 'seeker-1': quest })).toThrow(
      /placement/,
    );
    expect(serializeWorld(world)).toEqual(before);
  });

  it('refuses running an Earth expedition against an Underworld field', () => {
    const world = createServerWorld('cave', 'cave-quest', 'scope', 'hero');
    const board = discBoard();
    const result = enterQuest(seekerProgress('seeker-1'), {
      questId: 'seeker-1',
      catalogue: ALL_QUESTS,
      seed: 'scope',
      board,
      start: board.start,
      field: cloneWorldField(world, world.heroCoordinates!),
      atBoard: true,
      hasRun: false,
    });
    expect(result).toMatchObject({ ok: false, reason: 'NOT_AT_BOARD' });
  });
});
