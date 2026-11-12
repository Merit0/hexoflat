import type { DomainEvent } from '../commands/types';
import {
  CountObjectiveSchema,
  type CountObjective,
  type Objective,
  type QuestDefinition,
} from './quest-definition';

export interface ObjectiveDescription {
  unitKey: string;
  target: number;
}

export interface ObjectiveHandler {
  onEvent(objective: Objective, progress: number, event: DomainEvent): number;
  isComplete(objective: Objective, progress: number): boolean;
  describe(objective: Objective): ObjectiveDescription;
}

export type ObjectiveRegistry = Readonly<Record<string, ObjectiveHandler>>;

function payloadOf(event: DomainEvent): Record<string, unknown> {
  return typeof event.payload === 'object' && event.payload !== null
    ? (event.payload as Record<string, unknown>)
    : {};
}

function matches(objective: CountObjective, event: DomainEvent): boolean {
  if (event.type !== objective.event) return false;
  const payload = payloadOf(event);
  return Object.entries(objective.where ?? {}).every(([field, value]) => payload[field] === value);
}

function gainOf(objective: CountObjective, event: DomainEvent): number {
  if (!objective.amountFrom) return 1;
  const raw = payloadOf(event)[objective.amountFrom];
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
}

const countHandler: ObjectiveHandler = {
  onEvent: (objective, progress, event) => {
    const count = CountObjectiveSchema.parse(objective);
    if (!matches(count, event)) return progress;
    return Math.min(count.target, progress + gainOf(count, event));
  },
  isComplete: (objective, progress) => progress >= CountObjectiveSchema.parse(objective).target,
  describe: (objective) => {
    const count = CountObjectiveSchema.parse(objective);
    return { unitKey: count.unitKey, target: count.target };
  },
};

const expeditionHandler: ObjectiveHandler = {
  onEvent: (_objective, progress) => progress,
  isComplete: () => false,
  describe: (objective) => ({
    unitKey: 'quest.unit.steps',
    target: objective.kind === 'expedition' ? objective.params.steps : 0,
  }),
};

export const OBJECTIVES: ObjectiveRegistry = {
  count: countHandler,
  expedition: expeditionHandler,
};

export function handlerFor(
  objective: Objective,
  registry: ObjectiveRegistry = OBJECTIVES,
): ObjectiveHandler {
  const handler = registry[objective.kind];
  if (!handler) throw new Error(`No objective handler for ${objective.kind}`);
  return handler;
}

export function describeQuest(
  quest: QuestDefinition,
  registry: ObjectiveRegistry = OBJECTIVES,
): ObjectiveDescription {
  return handlerFor(quest.objective, registry).describe(quest.objective);
}
