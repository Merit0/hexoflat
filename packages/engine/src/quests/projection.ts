import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { coordinateKey } from '../utils/hex-utils';
import { positionOf, type QuestRun, type SeekerOutcome } from './quest-state';

export interface QuestProjection {
  offerId: string;
  phase: QuestRun['phase'];
  outcome: SeekerOutcome | null;
  start: IHexCoordinates;
  position: IHexCoordinates;
  path: { hex: IHexCoordinates; number: number }[];
  opened: { hex: IHexCoordinates; number: number; footprint: boolean }[];
  hintHex: IHexCoordinates | null;
  chest: { hex: IHexCoordinates } | null;
  stepCost: number;
  backCost: number;
}

function parseKey(key: string): IHexCoordinates {
  const [columnIndex, rowIndex] = key.split(':').map(Number);
  return { columnIndex, rowIndex };
}

export function projectQuestForClient(run: QuestRun): QuestProjection {
  const onPath = new Set(run.path.map((step) => coordinateKey(step.hex)));
  const hintActive = !run.everDeviated && !run.steppedBack && run.path.length < run.hintSteps;
  const hint = hintActive ? (run.trail[run.path.length] ?? null) : null;
  const hintVisible = hint !== null && coordinateKey(hint) in run.revealed;
  return {
    offerId: run.offerId,
    phase: run.phase,
    outcome: run.outcome,
    start: run.start,
    position: positionOf(run),
    path: run.path.map((step) => ({ hex: step.hex, number: step.number })),
    opened: Object.entries(run.revealed)
      .map(([key, entry]) => ({
        hex: parseKey(key),
        number: entry.number,
        footprint: run.visited.includes(key) && !onPath.has(key),
      }))
      .sort((a, b) => coordinateKey(a.hex).localeCompare(coordinateKey(b.hex))),
    hintHex: hintVisible ? hint : null,
    chest: run.chest ? { hex: run.chest.hex } : null,
    stepCost: run.stepCost,
    backCost: run.stepCost * run.backMultiplier,
  };
}
