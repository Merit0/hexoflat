import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { QuestProjection } from '@hexoflat/engine/quests/projection';
import { FIELD_CENTER, FIELD_RADIUS } from '@hexoflat/engine/quests/treasure-field';
import {
  axialToOffset,
  coordinateKey,
  getHexNeighbors,
  hexDistance,
} from '@hexoflat/engine/utils/hex-utils';

export interface QuestFieldHex {
  hex: IHexCoordinates;
  number: number | null;
  footprint: boolean;
  hint: boolean;
  step: { cost: number; back: boolean } | null;
}

export interface QuestFieldModel {
  fog: IHexCoordinates[];
  hexes: QuestFieldHex[];
  position: IHexCoordinates;
  chest: IHexCoordinates | null;
  chestEmpty: boolean;
  ground: QuestFieldStack[];
  walking: boolean;
  collect: boolean;
}

export interface QuestFieldStack {
  hex: IHexCoordinates;
  itemKey: string;
  amount: number;
}

export const EMPTY_FIELD: QuestFieldModel = {
  fog: [],
  hexes: [],
  position: { columnIndex: 0, rowIndex: 0 },
  chest: null,
  chestEmpty: false,
  ground: [],
  walking: false,
  collect: false,
};

export function fieldHexagon(): IHexCoordinates[] {
  const all: IHexCoordinates[] = [];
  for (let dq = -FIELD_RADIUS; dq <= FIELD_RADIUS; dq += 1) {
    const from = Math.max(-FIELD_RADIUS, -dq - FIELD_RADIUS);
    const to = Math.min(FIELD_RADIUS, -dq + FIELD_RADIUS);
    for (let dr = from; dr <= to; dr += 1) {
      all.push(axialToOffset({ q: FIELD_CENTER.q + dq, r: FIELD_CENTER.r + dr }));
    }
  }
  return all;
}

export function previousHex(run: QuestProjection): IHexCoordinates | null {
  if (run.path.length === 0) return null;
  return run.path.length >= 2 ? run.path[run.path.length - 2].hex : run.start;
}

export function buildQuestField(run: QuestProjection): QuestFieldModel {
  const walking = run.phase === 'walking';
  const collecting = run.phase === 'collect';
  const ground = run.collect?.ground ?? [];
  const groundKeys = new Set(ground.map((stack) => coordinateKey(stack.hex)));
  const here = coordinateKey(run.position);
  const near = new Set(getHexNeighbors(run.position).map(coordinateKey));
  const back = previousHex(run);
  const backKey = back ? coordinateKey(back) : null;
  const hint = run.hintHex ? coordinateKey(run.hintHex) : null;
  const chestKey = run.chest ? coordinateKey(run.chest.hex) : null;
  const seen = new Set<string>();
  const hexes: QuestFieldHex[] = [];
  const add = (hex: IHexCoordinates, number: number | null, footprint: boolean) => {
    const key = coordinateKey(hex);
    if (seen.has(key)) return;
    seen.add(key);
    const isBack = key === backKey;
    const reachable =
      walking && key !== here && key !== chestKey && (isBack || (!run.chest && near.has(key)));
    const free = collecting && near.has(key) && key !== chestKey && !groundKeys.has(key);
    hexes.push({
      hex,
      number: collecting ? null : number,
      footprint,
      hint: key === hint,
      step: free
        ? { cost: 0, back: false }
        : reachable
          ? { cost: isBack ? run.backCost : run.stepCost, back: isBack }
          : null,
    });
  };
  for (const opened of run.opened) add(opened.hex, opened.number, opened.footprint);
  add(run.start, null, false);
  if (run.chest) add(run.chest.hex, null, false);
  add(run.position, null, false);
  for (const hex of run.collect?.seen ?? []) add(hex, null, false);
  for (const stack of ground) add(stack.hex, null, false);
  return {
    fog: fieldHexagon().filter((hex) => !seen.has(coordinateKey(hex))),
    hexes,
    position: run.position,
    chest: run.chest ? run.chest.hex : null,
    chestEmpty: run.chest?.empty === true,
    ground: ground.map((stack) => ({ ...stack, hex: { ...stack.hex } })),
    walking,
    collect: collecting,
  };
}

export type FieldClick = { kind: 'step'; hex: IHexCoordinates } | { kind: 'back' } | null;

export type QuestHandAction = 'eye' | 'take';

export function questHandAction(run: QuestProjection, at: IHexCoordinates): QuestHandAction | null {
  const key = coordinateKey(at);
  const near = new Set(getHexNeighbors(run.position).map(coordinateKey));
  if (!near.has(key)) return null;
  if (run.phase === 'walking' && run.chest && coordinateKey(run.chest.hex) === key) return 'eye';
  if (run.phase !== 'collect') return null;
  return (run.collect?.ground ?? []).some((stack) => coordinateKey(stack.hex) === key)
    ? 'take'
    : null;
}

export function questToolHexAt(
  run: QuestProjection,
  pointer: IHexCoordinates | null,
): IHexCoordinates | null {
  if (run.phase !== 'walking' && run.phase !== 'collect') return null;
  const neighbours = getHexNeighbors(run.position);
  if (!neighbours.length) return null;
  if (!pointer) return neighbours[0];
  let best = neighbours[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const neighbour of neighbours) {
    const distance = hexDistance(neighbour, pointer);
    if (distance < bestDistance) {
      best = neighbour;
      bestDistance = distance;
    }
  }
  return best;
}

export function resolveFieldClick(run: QuestProjection, hex: IHexCoordinates): FieldClick {
  const key = coordinateKey(hex);
  if (run.phase === 'collect') return resolveCollectClick(run, hex, key);
  if (run.phase !== 'walking') return null;
  if (run.chest) {
    const back = previousHex(run);
    return back && key === coordinateKey(back) ? { kind: 'back' } : null;
  }
  const back = previousHex(run);
  if (back && key === coordinateKey(back)) return { kind: 'back' };
  return { kind: 'step', hex };
}

function resolveCollectClick(run: QuestProjection, hex: IHexCoordinates, key: string): FieldClick {
  if (run.chest && key === coordinateKey(run.chest.hex)) return null;
  const ground = run.collect?.ground ?? [];
  if (ground.some((stack) => coordinateKey(stack.hex) === key)) return null;
  const seen = (run.collect?.seen ?? []).some((candidate) => coordinateKey(candidate) === key);
  const near = getHexNeighbors(run.position).some((candidate) => coordinateKey(candidate) === key);
  return seen && near ? { kind: 'step', hex } : null;
}
