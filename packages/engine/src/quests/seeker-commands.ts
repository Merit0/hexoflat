import { z } from 'zod';
import type { ProgressState, Presence } from '../aggregates/progress-state';
import type { DomainEvent } from '../commands/types';
import type { InventoryState } from '../inventory/inventory-state';
import { ALL_QUESTS } from './all-quests';
import { hexSchema, parseQuestRun, type QuestRun } from './quest-state';
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
import { createTreasureField } from './treasure-field';

const hero = { heroId: z.string().min(1) };

export const QUEST_RUN_COMMAND_SCHEMAS = {
  QUEST_ENTER: z
    .object({
      type: z.literal('QUEST_ENTER'),
      payload: z.object({ ...hero, questId: z.string().min(1).max(64) }).strict(),
    })
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
}

export function parseQuestRunDoc(raw: string): QuestRunDoc {
  const parsed = JSON.parse(raw) as { run: unknown; camp: Presence | null };
  return { run: parseQuestRun(parsed.run), camp: parsed.camp };
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

export function executeQuestRunCommand(input: {
  progress: ProgressState;
  doc: QuestRunDoc | null;
  command: QuestRunCommand;
  atBoard: boolean;
  inventory?: InventoryState;
  newSeed: () => string;
}): QuestRunOutcome {
  const { progress, doc, command } = input;
  if (command.type === 'QUEST_ENTER') {
    const seed = input.newSeed();
    const field = createTreasureField(seed);
    const entered = enterQuest(progress, {
      questId: command.payload.questId,
      catalogue: ALL_QUESTS,
      seed,
      board: field,
      start: field.start,
      atBoard: input.atBoard,
      hasRun: doc !== null,
    });
    return settle(entered, progress.presence, null);
  }
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
  const board = createTreasureField(doc.run.seed);
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
