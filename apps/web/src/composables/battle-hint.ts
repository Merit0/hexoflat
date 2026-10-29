import type { DomainEvent } from '@hexoflat/engine/commands/types';
import { BATTLE_REJECTION_CODES } from '@hexoflat/engine/battle/battle-rejection';
import { BATTLE_BEHAVIOURS } from '@hexoflat/engine/battle/battle-catalogue';
import { BATTLE_HANDS, TASK_KINDS } from '@hexoflat/engine/battle/battle-state';
import { BATTLE_LEGEND_ITEMS } from '@/render/battle/battle-look';

export interface BattleMessage {
  key: string;
  params?: Record<string, string | number>;
}

export type NameOf = (id: string) => string;

export const BATTLE_HINT_KEYS = [
  'moved',
  'undone',
  'struck',
  'blocked',
  'hitTaken',
  'dodged',
  'dodgeFailed',
  'sawDodged',
  'sawCut',
  'displaced',
  'displaceFailed',
  'swapped',
  'used',
  'fell',
] as const;

export const BATTLE_ACTION_NAMES = [
  'place-shield',
  'remove-shield',
  'confirm-block',
  'take-hit',
  'start-dodge',
  'push',
  'pull',
  'answer-task',
  'task-timeout',
  'move',
  'undo-step',
  'strike',
  'swap-item',
  'use-item',
  'end-turn',
] as const;

const ID_DRIVEN_KEYS = [
  'tag.yourTurn',
  'tag.next',
  'tag.done',
  'tag.fallen',
  'hand.weapon',
  'hand.consumable',
  'hand.shield',
  'hand.struck',
  'stage.action',
  'stage.move',
  'action.strike',
  'action.push',
  'action.pull',
  'action.swap',
  'hint.act.move',
  'hint.act.strike',
  'hint.act.push',
  'hint.act.pull',
  'hint.act.swap',
];

export function battleLocaleKeys(): string[] {
  return [
    ...ID_DRIVEN_KEYS.map((k) => `battle.${k}`),
    ...BATTLE_HINT_KEYS.map((k) => `battle.hint.${k}`),
    ...BATTLE_REJECTION_CODES.map((c) => `battle.reject.${c}`),
    ...BATTLE_ACTION_NAMES.map((a) => `battle.actionName.${a}`),
    ...BATTLE_BEHAVIOURS.flatMap((b) => [`battle.role.${b}`, `battle.roleShort.${b}`]),
    ...BATTLE_HANDS.map((h) => `battle.hand.${h}`),
    ...TASK_KINDS.flatMap((k) => [`battle.task.title.${k}`, `battle.task.text.${k}`]),
    ...BATTLE_LEGEND_ITEMS.map((i) => `battle.legend.${i}`),
  ];
}

function find<T>(events: DomainEvent[], type: string): T | null {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === type) return events[i].payload as T;
  }
  return null;
}

function rejection(events: DomainEvent[]): BattleMessage | null {
  const refused = find<{ rejected: string; cost?: number; left?: number; action?: string }>(
    events,
    'BATTLE_REJECTED',
  );
  if (!refused) return null;
  return {
    key: `battle.reject.${refused.rejected}`,
    params: {
      cost: refused.cost ?? 0,
      left: refused.left ?? 0,
      action: `battle.actionName.${refused.action ?? 'move'}`,
    },
  };
}

interface TaskResolved {
  kind: 'dodge' | 'saw' | 'push' | 'pull';
  correct: boolean;
  late: boolean;
  answer: number;
}

function taskMessage(task: TaskResolved): BattleMessage | null {
  const params = { answer: task.answer, late: task.late ? 'yes' : 'no' };
  if (task.kind === 'dodge')
    return { key: task.correct ? 'battle.hint.dodged' : 'battle.hint.dodgeFailed', params };
  if (task.kind === 'saw')
    return { key: task.correct ? 'battle.hint.sawDodged' : 'battle.hint.sawCut', params };
  return task.correct ? null : { key: 'battle.hint.displaceFailed', params };
}

interface Resolved {
  results: { outcome: 'blocked' | 'hit' | 'dodged'; damage: number }[];
  burnedShields: unknown[];
}

function resolvedMessage(resolved: Resolved): BattleMessage {
  const damage = resolved.results.reduce((sum, r) => sum + r.damage, 0);
  const params = { hearts: damage / 2, burned: resolved.burnedShields.length };
  return { key: damage > 0 ? 'battle.hint.hitTaken' : 'battle.hint.blocked', params };
}

function fellMessage(events: DomainEvent[], nameOf: NameOf): BattleMessage | null {
  const fell = find<{ creatureId: string }>(events, 'CREATURE_FELL');
  return fell ? { key: 'battle.hint.fell', params: { name: nameOf(fell.creatureId) } } : null;
}

function outcomeMessage(events: DomainEvent[], nameOf: NameOf): BattleMessage | null {
  const task = find<TaskResolved>(events, 'TASK_RESOLVED');
  const taskHint = task ? taskMessage(task) : null;
  if (taskHint) return taskHint;
  const resolved = find<Resolved>(events, 'STRIKES_RESOLVED');
  if (resolved) return resolvedMessage(resolved);
  const moved = find<{ targetId: string; mode: string; slid: boolean; fell: boolean }>(
    events,
    'DISPLACED',
  );
  if (!moved) return null;
  return {
    key: 'battle.hint.displaced',
    params: {
      mode: moved.mode,
      name: nameOf(moved.targetId),
      slid: moved.slid ? 'yes' : 'no',
      fell: moved.fell ? 'yes' : 'no',
    },
  };
}

function actionMessage(events: DomainEvent[], nameOf: NameOf): BattleMessage | null {
  const struck = find<{ targetId: string }>(events, 'STRIKE_DEALT');
  if (struck) return { key: 'battle.hint.struck', params: { name: nameOf(struck.targetId) } };
  const used = find<{ itemKey: string; healed: number }>(events, 'ITEM_USED');
  if (used)
    return {
      key: 'battle.hint.used',
      params: { item: `content.battle.${used.itemKey}.title`, hearts: used.healed / 2 },
    };
  const swapped = find<{ taken: string; hand: string }>(events, 'ITEM_SWAPPED');
  if (swapped)
    return {
      key: 'battle.hint.swapped',
      params: { item: `content.battle.${swapped.taken}.title`, hand: swapped.hand },
    };
  if (find(events, 'MOVE_UNDONE')) return { key: 'battle.hint.undone' };
  const steps = events.filter((e) => e.type === 'CREATURE_MOVED');
  if (!steps.length) return null;
  const cost = steps.reduce((sum, e) => sum + (e.payload as { cost: number }).cost, 0);
  return { key: 'battle.hint.moved', params: { cost, steps: steps.length } };
}

export function battleHint(events: DomainEvent[], nameOf: NameOf): BattleMessage | null {
  return (
    rejection(events) ??
    fellMessage(events, nameOf) ??
    outcomeMessage(events, nameOf) ??
    actionMessage(events, nameOf)
  );
}
