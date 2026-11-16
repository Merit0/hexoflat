import type { ProgressState } from '../aggregates/progress-state';
import { questAnswerReview } from './quest-answer-review';
import { resolveSeekerPath } from './resolve-seeker-path';
import type { DomainEvent } from '../commands/types';
import { createContainer } from '../containers';
import { lootTableOf } from '../content/loot-tables.content';
import { spendWill } from '../knowledge/will';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { deriveStream } from '../utils/random-seeded';
import { coordinateKey, getHexNeighbors, offsetToAxial } from '../utils/hex-utils';
import { expectedNumber, revealRing, type RevealedHex } from './numbers';
import type { QuestCatalogue } from './quest-definition';
import {
  floorKeys,
  positionOf,
  type QuestRun,
  type SeekerBoard,
  type SeekerField,
  type SeekerOutcome,
} from './quest-state';
import { generateSequence } from './sequences/generate';
import { RULES, continueFrom, type RuleRegistry } from './sequences/rules';
import { generateTrail } from './trail';
import { seekerCollectStep } from './seeker-chest';
import { SEEKER_RULES } from './seeker-content';
import { reject, type SeekerResult } from './seeker-result';

export { seekerOpenChest, seekerPickup } from './seeker-chest';
export { SEEKER_REFUSALS, type SeekerRefusal, type SeekerResult } from './seeker-result';

export interface SeekerOptions {
  registry?: RuleRegistry;
  ambushEnabled?: boolean;
}

function revealedEvent(heroId: string, offerId: string, hexes: RevealedHex[]): DomainEvent {
  return {
    type: 'QUEST_HEXES_REVEALED',
    payload: { heroId, questId: offerId, hexes: hexes.map(({ hex, number }) => ({ hex, number })) },
  };
}

function mergeRevealed(run: QuestRun, hexes: RevealedHex[]): void {
  const by = coordinateKey(positionOf(run));
  for (const { hex, number } of hexes) {
    run.revealed[coordinateKey(hex)] = { number, revealedBy: by };
  }
}

export function enterQuest(
  progress: ProgressState,
  input: {
    questId: string;
    catalogue: QuestCatalogue;
    seed: string;
    board: SeekerBoard;
    start: IHexCoordinates;
    field?: SeekerField;
    atBoard: boolean;
    hasRun: boolean;
  },
  options: SeekerOptions = {},
): SeekerResult {
  const registry = options.registry ?? RULES;
  const quest = input.catalogue[input.questId];
  if (!quest || quest.objective.kind !== 'expedition') {
    return reject(progress, input.questId, 'UNKNOWN_QUEST');
  }
  if (input.hasRun) return reject(progress, input.questId, 'QUEST_IN_PROGRESS');
  if (!input.atBoard) return reject(progress, input.questId, 'NOT_AT_BOARD');
  if (!progress.quests.active.some((entry) => entry.questId === input.questId)) {
    return reject(progress, input.questId, 'NOT_ACTIVE');
  }

  const params = quest.objective.params;
  const sequence = generateSequence(
    {
      steps: params.steps,
      hintSteps: params.hintSteps,
      maxDigits: params.maxDigits,
      rulePool: params.rulePool,
    },
    deriveStream(input.seed, `quest:${input.questId}:rule`),
    registry,
  );
  const trail = generateTrail(
    input.board,
    input.start,
    params.steps,
    deriveStream(input.seed, `quest:${input.questId}:trail`),
  );
  if (!trail) return reject(progress, input.questId, 'NO_ROOM_FOR_TRAIL');

  const run: QuestRun = {
    offerId: input.questId,
    seed: input.seed,
    rule: sequence.rule,
    terms: sequence.terms,
    trail: trail.trail,
    chestHex: trail.chestHex,
    chestLootTableId: params.chestLootTableId,
    start: input.start,
    stepCost: params.stepCost,
    backMultiplier: params.backMultiplier,
    hintSteps: sequence.hintSteps,
    maxDigits: params.maxDigits,
    path: [],
    lines: [],
    everDeviated: false,
    steppedBack: false,
    firstDeviation: null,
    stepsTaken: 0,
    deviationsTotal: 0,
    revealed: {},
    visited: [coordinateKey(input.start)],
    chest: null,
    collect: null,
    phase: 'walking',
    outcome: null,
    ...(input.field ? { field: input.field } : {}),
  };
  const ring = revealRing(run, input.board, registry).hexes;
  mergeRevealed(run, ring);
  const heroId = progress.knowledge.heroId;
  return {
    ok: true,
    progress,
    run,
    events: [
      { type: 'QUEST_STARTED', payload: { heroId, questId: input.questId } },
      revealedEvent(heroId, input.questId, ring),
    ],
  };
}

function finish(
  progress: ProgressState,
  run: QuestRun,
  outcome: SeekerOutcome,
  reason: string | null,
): { progress: ProgressState; events: DomainEvent[] } {
  const next = structuredClone(progress);
  next.quests.active = next.quests.active.filter((entry) => entry.questId !== run.offerId);
  if (run.resolution) {
    outcome = run.resolution;
    reason = outcome === 'treasure' ? null : 'TREASURE_LOST';
  }
  if (outcome === 'treasure' && !run.resolution) {
    next.quests.done[run.offerId] = (next.quests.done[run.offerId] ?? 0) + 1;
  }
  const answerReview = questAnswerReview(run);
  run.phase = 'ended';
  run.outcome = outcome;
  const heroId = next.knowledge.heroId;
  const recap = {
    numbers: run.path.map((step) => step.number),
    firstDeviation: run.firstDeviation,
    ...(answerReview ? { answerReview } : {}),
  };
  const closing: DomainEvent =
    reason === null
      ? { type: 'QUEST_COMPLETED', payload: { heroId, questId: run.offerId, outcome, recap } }
      : { type: 'QUEST_FAILED', payload: { heroId, questId: run.offerId, reason, recap } };
  const summary: DomainEvent = {
    type: 'QUEST_SUMMARY',
    payload: {
      offerId: run.offerId,
      selfSteps: run.stepsTaken,
      deviationsTotal: run.deviationsTotal,
      outcome,
    },
  };
  return { progress: next, events: [closing, summary] };
}

function strandedCheck(
  progress: ProgressState,
  run: QuestRun,
): { progress: ProgressState; events: DomainEvent[] } | null {
  if (run.chest || run.phase === 'lost' || progress.knowledge.current >= run.stepCost) return null;
  return finish(progress, run, 'stranded', 'STRANDED');
}

function placeLure(run: QuestRun, board: SeekerBoard): IHexCoordinates | null {
  const here = positionOf(run);
  const previous = run.path.length > 1 ? run.path[run.path.length - 2].hex : run.start;
  const floor = floorKeys(board);
  const avoid = new Set([
    coordinateKey(previous),
    coordinateKey(run.chestHex),
    ...run.trail.map(coordinateKey),
  ]);
  const options = getHexNeighbors(here)
    .filter((hex) => floor.has(coordinateKey(hex)) && !avoid.has(coordinateKey(hex)))
    .sort((a, b) => coordinateKey(a).localeCompare(coordinateKey(b)));
  if (options.length === 0) return null;
  const random = deriveStream(run.seed, `quest:${run.offerId}:lure:${run.path.length}`);
  return options[Math.floor(random() * options.length)];
}

function showChest(
  run: QuestRun,
  board: SeekerBoard,
  events: DomainEvent[],
  heroId: string,
  ambushEnabled: boolean,
): void {
  if (run.path.length < run.terms.length && run.lines.length === 0) return;
  const real = run.lines.length === 0;
  if (!real && !ambushEnabled) {
    run.phase = 'lost';
    events.push({
      type: 'QUEST_LOST',
      payload: { heroId, questId: run.offerId, reason: 'TREASURE_LOST' },
    });
    return;
  }
  const hex = real ? run.chestHex : placeLure(run, board);
  if (!hex) return;
  run.chest = { hex, kind: real ? 'real' : 'lure', appearedAtStep: run.path.length };
  if (real && run.chestLootTableId) {
    const container = createContainer({
      id: coordinateKey(hex),
      kind: 'quest-chest',
      at: offsetToAxial(hex),
      tables: [lootTableOf(run.chestLootTableId)],
      seed: run.seed,
      sourceId: run.seed,
      targetKey: coordinateKey(hex),
    });
    const drop = container.contents?.[0] ?? [];
    if (drop.length === 0) throw new Error(`CHEST_DROP_EMPTY:${run.chestLootTableId}`);
    run.chest.container = container;
  }
  events.push({ type: 'CHEST_APPEARED', payload: { heroId, questId: run.offerId, hex } });
}

export function seekerStep(
  progress: ProgressState,
  source: QuestRun,
  hex: IHexCoordinates,
  board: SeekerBoard,
  options: SeekerOptions = {},
): SeekerResult {
  const registry = options.registry ?? RULES;
  if (source.phase === 'collect') return seekerCollectStep(progress, source, hex, board);
  if (source.phase !== 'walking' || source.chest || source.path.length >= source.terms.length) {
    return reject(progress, source, 'WRONG_PHASE');
  }
  const key = coordinateKey(hex);
  const here = positionOf(source);
  if (!getHexNeighbors(here).some((candidate) => coordinateKey(candidate) === key)) {
    return reject(progress, source, 'NOT_ADJACENT');
  }
  const previous = source.path.length > 1 ? source.path[source.path.length - 2].hex : source.start;
  if (coordinateKey(previous) === key) return reject(progress, source, 'USE_STEP_BACK');
  if (!(key in source.revealed)) return reject(progress, source, 'HEX_NOT_REVEALED');
  const have = progress.knowledge.current;
  if (have < source.stepCost) {
    return reject(progress, source, 'INSUFFICIENT_WILL', { cost: source.stepCost, have });
  }

  const run = structuredClone(source);
  const next = structuredClone(progress);
  const heroId = next.knowledge.heroId;
  const events: DomainEvent[] = spendWill(
    next.knowledge,
    run.stepCost,
    'quest',
    `quest:${run.offerId}`,
  ).events;
  next.knowledge.revision++;

  const number = run.revealed[key].number;
  run.path.push({ hex, number });
  run.stepsTaken += 1;
  if (!run.visited.includes(key)) run.visited.push(key);
  const position = run.path.length;
  const expected = expectedNumber(run, position);
  if (expected !== null && number !== expected) {
    run.everDeviated = true;
    run.deviationsTotal += 1;
    run.firstDeviation ??= { number, expected };
    run.lines.push({
      fromStep: position,
      values: [number, ...continueFrom(run.rule, position, number, run.terms.length, registry)],
    });
  }
  events.push({
    type: 'QUEST_STEPPED',
    payload: { heroId, questId: run.offerId, hex, number, cost: run.stepCost },
  });

  const ring = revealRing(run, board, registry);
  mergeRevealed(run, ring.hexes);
  events.push(revealedEvent(heroId, run.offerId, ring.hexes));
  const falseDeadEnd = run.lines.length > 0 && position < run.terms.length && !ring.continuation;
  if (falseDeadEnd || position >= run.terms.length)
    showChest(run, board, events, heroId, options.ambushEnabled ?? SEEKER_RULES.ambushEnabled);
  events.push(...resolveSeekerPath(next, run));
  const stranded = strandedCheck(next, run);
  if (stranded)
    return { ok: true, progress: stranded.progress, run, events: [...events, ...stranded.events] };
  return { ok: true, progress: next, run, events };
}

export function seekerStepBack(
  progress: ProgressState,
  source: QuestRun,
  board: SeekerBoard,
  options: SeekerOptions = {},
): SeekerResult {
  void options;
  void board;
  if (source.phase !== 'walking' || source.resolution)
    return reject(progress, source, 'WRONG_PHASE');
  if (source.path.length === 0) return reject(progress, source, 'NOTHING_TO_STEP_BACK');
  const cost = source.stepCost * source.backMultiplier;
  const have = progress.knowledge.current;
  if (have < cost) return reject(progress, source, 'INSUFFICIENT_WILL', { cost, have });

  const run = structuredClone(source);
  const next = structuredClone(progress);
  const heroId = next.knowledge.heroId;
  const events: DomainEvent[] = spendWill(
    next.knowledge,
    cost,
    'quest',
    `quest:${run.offerId}`,
  ).events;
  next.knowledge.revision++;

  const left = run.path[run.path.length - 1];
  const leftKey = coordinateKey(left.hex);
  const leftStep = run.path.length;
  run.path.pop();
  run.steppedBack = true;
  const top = run.lines[run.lines.length - 1];
  if (top && top.fromStep === leftStep) run.lines.pop();

  const fogged: IHexCoordinates[] = [];
  for (const [key, entry] of Object.entries(run.revealed)) {
    if (entry.revealedBy !== leftKey || key === leftKey) continue;
    delete run.revealed[key];
    const [columnIndex, rowIndex] = key.split(':').map(Number);
    fogged.push({ columnIndex, rowIndex });
  }
  events.push({
    type: 'QUEST_STEPPED_BACK',
    payload: { heroId, questId: run.offerId, hex: positionOf(run), cost },
  });
  if (fogged.length > 0) {
    events.push({
      type: 'QUEST_HEXES_FOGGED',
      payload: { heroId, questId: run.offerId, hexes: fogged },
    });
  }
  if (run.chest && run.chest.appearedAtStep >= leftStep) {
    events.push({
      type: 'CHEST_VANISHED',
      payload: { heroId, questId: run.offerId, hex: run.chest.hex },
    });
    delete run.revealed[coordinateKey(run.chest.hex)];
    run.chest = null;
  }
  const stranded = strandedCheck(next, run);
  if (stranded)
    return { ok: true, progress: stranded.progress, run, events: [...events, ...stranded.events] };
  return { ok: true, progress: next, run, events };
}

export function seekerGiveUp(progress: ProgressState, source: QuestRun): SeekerResult {
  if (source.phase !== 'walking' && source.phase !== 'ambush' && source.phase !== 'lost') {
    return reject(progress, source, 'WRONG_PHASE');
  }
  const run = structuredClone(source);
  if (run.phase === 'lost') {
    const lost = finish(progress, run, 'lost', 'TREASURE_LOST');
    return { ok: true, progress: lost.progress, run, events: lost.events };
  }
  const closing = finish(progress, run, 'left', 'LEFT');
  return { ok: true, progress: closing.progress, run, events: closing.events };
}

export function seekerReturn(progress: ProgressState, source: QuestRun): SeekerResult {
  if (source.phase !== 'collect') return reject(progress, source, 'WRONG_PHASE');
  const run = structuredClone(source);
  const closing = finish(progress, run, 'treasure', null);
  return { ok: true, progress: closing.progress, run, events: closing.events };
}
