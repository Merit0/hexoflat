import type { ProgressState } from '../aggregates/progress-state';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { axialToOffset, coordinateKey, getHexNeighbors } from '../utils/hex-utils';
import { progressWith } from './quest-test-setup';
import { enterQuest, seekerStep, type SeekerResult } from './seeker-actions';
import type { QuestRun, SeekerBoard } from './quest-state';
import { SEEKER_CATALOGUE } from './seeker-quests';
import type { QuestCatalogue } from './quest-definition';
import type { RuleRegistry } from './sequences/rules';

const CENTER = { q: 12, r: 12 };

export function discBoard(radius = 7): SeekerBoard & { start: IHexCoordinates } {
  const floor: IHexCoordinates[] = [];
  for (let dq = -radius; dq <= radius; dq += 1) {
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr += 1) {
      floor.push(axialToOffset({ q: CENTER.q + dq, r: CENTER.r + dr }));
    }
  }
  const start = axialToOffset({ q: CENTER.q - radius + 1, r: CENTER.r });
  return { floor, start };
}

export function seekerProgress(questId: string, will = 50): ProgressState {
  const progress = progressWith(will);
  progress.quests.active.push({ questId, progress: 0, state: 'active' });
  return progress;
}

export interface Started {
  progress: ProgressState;
  run: QuestRun;
  board: ReturnType<typeof discBoard>;
}

export function startQuest(
  questId: string,
  seed: string,
  will = 50,
  catalogue: QuestCatalogue = SEEKER_CATALOGUE,
  registry?: RuleRegistry,
): Started {
  const board = discBoard();
  const entered = enterQuest(
    seekerProgress(questId, will),
    { questId, catalogue, seed, board, start: board.start, atBoard: true, hasRun: false },
    { registry },
  );
  if (!entered.ok) throw new Error(`enter refused: ${entered.reason}`);
  return { progress: entered.progress, run: entered.run, board };
}

export function must(result: SeekerResult): Extract<SeekerResult, { ok: true }> {
  if (!result.ok) throw new Error(`refused: ${result.reason}`);
  return result;
}

export function followTruth(
  state: Started,
  steps: number,
  registry?: RuleRegistry,
): { progress: ProgressState; run: QuestRun; events: SeekerResult['events'] } {
  let { progress, run } = state;
  const events: SeekerResult['events'] = [];
  for (let i = 0; i < steps; i += 1) {
    const result = must(
      seekerStep(progress, run, run.trail[run.path.length], state.board, { registry }),
    );
    ({ progress, run } = result);
    events.push(...result.events);
  }
  return { progress, run, events };
}

export function decoyHexAround(run: QuestRun): IHexCoordinates {
  const trailKeys = new Set(run.trail.map(coordinateKey));
  const here = run.path.length > 0 ? run.path[run.path.length - 1].hex : run.start;
  const previous = run.path.length > 1 ? run.path[run.path.length - 2].hex : run.start;
  const found = getHexNeighbors(here).find((hex) => {
    const key = coordinateKey(hex);
    return key in run.revealed && !trailKeys.has(key) && key !== coordinateKey(previous);
  });
  if (!found) throw new Error('no decoy hex');
  return found;
}
