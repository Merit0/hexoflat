import { CONTENT } from '../content/content-map';
import { availableInDimension } from '../dimensions/availability';
import { EDimension } from '../dimensions/dimensions';
import { TRADERS } from '../content/traders.content';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { sellUnitPrice } from '../trade/trader-view';
import {
  QuestDefinitionSchema,
  type QuestCatalogue,
  type QuestDefinition,
  type Reward,
} from './quest-definition';

export const BOARD_QUESTS: readonly QuestDefinition[] = [
  {
    id: 'woodcutter',
    dimension: EDimension.EARTH,
    locations: ['silesia', 'silesia-north'],
    nameKey: 'quest.woodcutter.name',
    descKey: 'quest.woodcutter.desc',
    repeat: 'repeatable',
    requires: [],
    accept: { kind: 'free' },
    objective: {
      kind: 'count',
      event: 'RESOURCE_GATHERED',
      where: { action: 'CUT' },
      target: 10,
      unitKey: 'quest.unit.trees',
    },
    rewards: [{ kind: 'item', itemKey: HEXOBJECT_KEYS.AXE, amount: 5 }],
    turnIn: 'board',
    maxSellValue: 120,
    tableRule: 'quest.woodcutter.table',
  },
  {
    id: 'stonebreaker',
    dimension: EDimension.EARTH,
    locations: ['silesia', 'silesia-north'],
    nameKey: 'quest.stonebreaker.name',
    descKey: 'quest.stonebreaker.desc',
    repeat: 'repeatable',
    requires: [],
    accept: { kind: 'free' },
    objective: {
      kind: 'count',
      event: 'RESOURCE_GATHERED',
      where: { action: 'MINE' },
      target: 8,
      unitKey: 'quest.unit.stones',
    },
    rewards: [{ kind: 'item', itemKey: HEXOBJECT_KEYS.COINS, amount: 30 }],
    turnIn: 'board',
    maxSellValue: 30,
    tableRule: 'quest.stonebreaker.table',
  },
  {
    id: 'scholar',
    dimension: EDimension.EARTH,
    locations: ['camping'],
    nameKey: 'quest.scholar.name',
    descKey: 'quest.scholar.desc',
    repeat: 'repeatable',
    requires: [],
    accept: { kind: 'free' },
    objective: {
      kind: 'count',
      event: 'HALL_ANSWERED',
      where: { correct: true },
      target: 15,
      unitKey: 'quest.unit.answers',
    },
    rewards: [{ kind: 'item', itemKey: HEXOBJECT_KEYS.COINS, amount: 20 }],
    turnIn: 'board',
    maxSellValue: 20,
    tableRule: 'quest.scholar.table',
  },
  {
    id: 'bone-hunter',
    dimension: EDimension.UNDERWORLD,
    locations: ['cave'],
    nameKey: 'quest.bone-hunter.name',
    descKey: 'quest.bone-hunter.desc',
    repeat: 'once',
    requires: [],
    accept: { kind: 'will', amount: 5 },
    objective: {
      kind: 'count',
      event: 'BATTLE_CLOSED',
      where: { outcome: 'victory' },
      amountFrom: 'kills',
      target: 3,
      unitKey: 'quest.unit.skeletons',
    },
    rewards: [{ kind: 'item', itemKey: HEXOBJECT_KEYS.SHIELD, amount: 1 }],
    turnIn: 'board',
    tableRule: 'quest.bone-hunter.table',
  },
];

export function catalogueOf(quests: readonly QuestDefinition[]): QuestCatalogue {
  return Object.fromEntries(quests.map((quest) => [quest.id, quest]));
}

export const QUESTS: QuestCatalogue = catalogueOf(BOARD_QUESTS);

export function rewardSellValue(reward: Reward): number {
  if (reward.kind === 'will') return 0;
  if (reward.itemKey === HEXOBJECT_KEYS.COINS) return reward.amount;
  const unit = sellUnitPrice(TRADERS.ilva, reward.itemKey);
  return (unit ?? 0) * reward.amount;
}

export function questSellValue(quest: QuestDefinition): number {
  return quest.rewards.reduce((sum, reward) => sum + rewardSellValue(reward), 0);
}

export function questContentFailures(quests: readonly QuestDefinition[] = BOARD_QUESTS): string[] {
  const failures: string[] = [];
  const ids = new Set<string>();
  for (const quest of quests) {
    const parsed = QuestDefinitionSchema.safeParse(quest);
    if (!parsed.success) failures.push(`${quest.id}: ${parsed.error.message}`);
    if (
      quest.mapObjectPlacement &&
      !availableInDimension(CONTENT[quest.mapObjectPlacement.objectKey], quest.dimension)
    )
      failures.push(
        `${quest.id}: place ${quest.mapObjectPlacement.objectKey} outside its dimension`,
      );
    if (ids.has(quest.id)) failures.push(`${quest.id}: duplicate id`);
    ids.add(quest.id);
    if (quest.rewards.length === 0 && quest.turnIn === 'board') {
      failures.push(`${quest.id}: board turn-in without a reward`);
    }
    if (quest.repeat === 'repeatable') {
      const value = questSellValue(quest);
      if (value > 0 && quest.maxSellValue === undefined) {
        failures.push(`${quest.id}: repeatable reward without maxSellValue`);
      } else if (quest.maxSellValue !== undefined && value > quest.maxSellValue) {
        failures.push(`${quest.id}: reward sells for ${value} over ${quest.maxSellValue}`);
      }
    }
  }
  for (const quest of quests) {
    for (const requirement of quest.requires) {
      if (!ids.has(requirement.questId)) {
        failures.push(`${quest.id}: unknown requirement ${requirement.questId}`);
      }
    }
  }
  return failures;
}
