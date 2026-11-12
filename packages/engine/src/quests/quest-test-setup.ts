import type { ProgressState } from '../aggregates/progress-state';
import { emptyProgressState } from '../aggregates/progress-state';
import { inventoryWith, HERO } from '../trade/trade-test-setup';
import type { DomainEvent } from '../commands/types';
import { catalogueOf, QUESTS } from './quests.content';
import type { QuestCatalogue, QuestContext, QuestDefinition } from './index';

export { HERO, inventoryWith };

export const AT_BOARD: QuestContext = { catalogue: QUESTS, atBoard: true };

export function progressWith(will: number, patch: Partial<ProgressState> = {}): ProgressState {
  const progress = emptyProgressState(HERO);
  progress.knowledge.current = will;
  return { ...progress, ...patch };
}

export function counting(
  id: string,
  event: string,
  target: number,
  extra: Partial<QuestDefinition> = {},
): QuestDefinition {
  return {
    id,
    nameKey: `quest.${id}.name`,
    descKey: `quest.${id}.desc`,
    repeat: 'repeatable',
    requires: [],
    accept: { kind: 'free' },
    objective: { kind: 'count', event, target, unitKey: 'quest.unit.test' },
    rewards: [{ kind: 'will', amount: 1 }],
    turnIn: 'board',
    tableRule: `quest.${id}.table`,
    ...extra,
  };
}

export function catalogueWith(...quests: QuestDefinition[]): QuestCatalogue {
  return catalogueOf(quests);
}

export function event(type: string, payload: Record<string, unknown> = {}): DomainEvent {
  return { type, payload };
}
