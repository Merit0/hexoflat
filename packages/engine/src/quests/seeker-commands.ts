import { z } from 'zod';
import { presenceSchema, type ProgressState, type Presence } from '../aggregates/progress-state';
import type { DomainEvent } from '../commands/types';
import type { InventoryState } from '../inventory/inventory-state';
import { ALL_QUESTS } from './all-quests';
import { hexSchema, parseQuestRun, positionOf, type QuestRun } from './quest-state';
import {
  enterQuest,
  seekerGiveUp,
  seekerOpenChest,
  seekerPickup,
  seekerReturn,
  seekerStep,
  seekerStepBack,
  type SeekerResult,
} from './seeker-actions';
import { hexDistance } from '../utils/hex-utils';
import { seekerBoardOf, seekerFieldView, type SeekerEntrance } from './origin-field';

const hero = { heroId: z.string().min(1) };

export const QUEST_RUN_COMMAND_SCHEMAS = {
  QUEST_ENTER: z
    .object({
      type: z.literal('QUEST_ENTER'),
      payload: z.object({ ...hero, questId: z.string().min(1).max(64) }).strict(),
    })
    .strict(),
  QUEST_PAUSE: z
    .object({ type: z.literal('QUEST_PAUSE'), payload: z.object(hero).strict() })
    .strict(),
  QUEST_STEP: z
    .object({
      type: z.literal('QUEST_STEP'),
      payload: z.object({ ...hero, hex: hexSchema }).strict(),
    })
    .strict(),
  QUEST_STEP_BACK: z
    .object({ type: z.literal('QUEST_STEP_BACK'), payload: z.object(hero).strict() })
    .strict(),
  QUEST_PICKUP: z
    .object({
      type: z.literal('QUEST_PICKUP'),
      payload: z.object({ ...hero, hex: hexSchema }).strict(),
    })
    .strict(),
  QUEST_OPEN_CHEST: z
    .object({ type: z.literal('QUEST_OPEN_CHEST'), payload: z.object(hero).strict() })
    .strict(),
  QUEST_RETURN: z
    .object({ type: z.literal('QUEST_RETURN'), payload: z.object(hero).strict() })
    .strict(),
  QUEST_GIVE_UP: z
    .object({ type: z.literal('QUEST_GIVE_UP'), payload: z.object(hero).strict() })
    .strict(),
} as const;

export type QuestRunCommandType = keyof typeof QUEST_RUN_COMMAND_SCHEMAS;
export type QuestRunCommand = z.infer<(typeof QUEST_RUN_COMMAND_SCHEMAS)[QuestRunCommandType]>;

export function isQuestRunCommandType(type: string): type is QuestRunCommandType {
  return Object.hasOwn(QUEST_RUN_COMMAND_SCHEMAS, type);
}

export interface QuestRunDoc {
  run: QuestRun;
  camp: Presence | null;
  suspended?: boolean;
}

const questRunDocSchema = z
  .object({
    run: z.unknown(),
    camp: presenceSchema.nullable(),
    suspended: z.boolean().optional(),
  })
  .strict();

export function parseQuestRunDoc(raw: string): QuestRunDoc {
  const parsed = questRunDocSchema.parse(JSON.parse(raw));
  return {
    run: parseQuestRun(parsed.run),
    camp: parsed.camp,
    ...(parsed.suspended === undefined ? {} : { suspended: parsed.suspended }),
  };
}

export function isStaleSuspendedRun(doc: QuestRunDoc, progress: ProgressState): boolean {
  return (
    doc.suspended === true &&
    (doc.run.resolution !== undefined ||
      !progress.quests.active.some(({ questId }) => questId === doc.run.offerId))
  );
}

export type QuestRunOutcome =
  | {
      ok: true;
      progress: ProgressState;
      doc: QuestRunDoc | null;
      events: DomainEvent[];
      inventory?: InventoryState;
    }
  | { ok: false; code: string; events: DomainEvent[] };

function settle(
  result: SeekerResult,
  camp: Presence | null,
  keepPresence: Presence | null,
): QuestRunOutcome {
  if (!result.ok) return { ok: false, code: result.reason, events: result.events };
  if (result.run.phase === 'ended') {
    return {
      ok: true,
      progress: { ...result.progress, presence: camp },
      doc: null,
      events: result.events,
      inventory: result.inventory,
    };
  }
  return {
    ok: true,
    progress: { ...result.progress, presence: keepPresence },
    doc: { run: result.run, camp },
    events: result.events,
    inventory: result.inventory,
  };
}

function chestTableOf(questId: string): string | undefined {
  const objective = ALL_QUESTS[questId]?.objective;
  return objective?.kind === 'expedition' ? objective.params.chestLootTableId : undefined;
}

export interface QuestRunInput {
  progress: ProgressState;
  doc: QuestRunDoc | null;
  command: QuestRunCommand;
  entrance: SeekerEntrance | null;
  camp?: Presence | null;
  inventory?: InventoryState;
  newSeed: () => string;
}

function enterRun(
  input: QuestRunInput,
  command: Extract<QuestRunCommand, { type: 'QUEST_ENTER' }>,
): QuestRunOutcome {
  const { progress } = input;
  const questId = command.payload.questId;
  const doc = input.doc && isStaleSuspendedRun(input.doc, progress) ? null : input.doc;
  if (doc && !doc.suspended) return { ok: false, code: 'QUEST_IN_PROGRESS', events: [] };
  if (doc && doc.run.offerId !== questId)
    return { ok: false, code: 'OTHER_QUEST_SUSPENDED', events: [] };
  if (!input.entrance) return { ok: false, code: 'NOT_AT_QUEST_ENTRANCE', events: [] };
  if (doc) {
    return {
      ok: true,
      progress: { ...progress, presence: null },
      doc: { ...doc, suspended: false },
      events: [
        {
          type: 'QUEST_RESUMED',
          payload: { heroId: progress.knowledge.heroId, questId: doc.run.offerId },
        },
      ],
    };
  }
  const seed = input.newSeed();
  const entered = enterQuest(progress, {
    questId,
    catalogue: ALL_QUESTS,
    seed,
    board: seekerFieldView(input.entrance.field),
    start: input.entrance.start,
    field: input.entrance.field,
    atBoard: true,
    hasRun: false,
  });
  return settle(entered, input.camp ?? progress.presence, null);
}

export function executeQuestRunCommand(input: QuestRunInput): QuestRunOutcome {
  const { progress, doc, command } = input;
  if (command.type === 'QUEST_ENTER') return enterRun(input, command);
  if (!doc) {
    return {
      ok: false,
      code: 'NO_RUN',
      events: [
        {
          type: 'QUEST_REJECTED',
          payload: { heroId: progress.knowledge.heroId, questId: '', reason: 'NO_RUN' },
        },
      ],
    };
  }
  if (doc.suspended) return { ok: false, code: 'QUEST_SUSPENDED', events: [] };
  if (command.type === 'QUEST_PAUSE') {
    const exit = seekerBoardOf(doc.run).exit;
    if (hexDistance(positionOf(doc.run), exit) !== 1)
      return { ok: false, code: 'NOT_ADJACENT', events: [] };
    return {
      ok: true,
      progress: { ...progress, presence: doc.camp },
      doc: { ...doc, suspended: true },
      events: [
        {
          type: 'QUEST_PAUSED',
          payload: { heroId: progress.knowledge.heroId, questId: doc.run.offerId },
        },
      ],
    };
  }
  const board = seekerBoardOf(doc.run);
  const { run } = doc;
  const result =
    command.type === 'QUEST_STEP'
      ? seekerStep(progress, run, command.payload.hex, board)
      : command.type === 'QUEST_STEP_BACK'
        ? seekerStepBack(progress, run, board)
        : command.type === 'QUEST_OPEN_CHEST'
          ? seekerOpenChest(progress, run, board, {
              inventory: input.inventory,
              tableId: chestTableOf(run.offerId),
            })
          : command.type === 'QUEST_PICKUP'
            ? seekerPickup(progress, run, command.payload.hex, input.inventory)
            : command.type === 'QUEST_RETURN'
              ? seekerReturn(progress, run)
              : seekerGiveUp(progress, run);
  return settle(result, doc.camp, null);
}
