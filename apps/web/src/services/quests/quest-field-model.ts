import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { QuestProjection } from '@hexoflat/engine/quests/projection';
import { FIELD_CENTER, FIELD_RADIUS } from '@hexoflat/engine/quests/treasure-field';
import { axialToOffset, coordinateKey, getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';

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
  pathLine: IHexCoordinates[];
  chest: IHexCoordinates | null;
  walking: boolean;
  collect: boolean;
}

export const EMPTY_FIELD: QuestFieldModel = {
  fog: [],
  hexes: [],
  position: { columnIndex: 0, rowIndex: 0 },
  pathLine: [],
  chest: null,
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
    hexes.push({
      hex,
      number: run.phase === 'collect' ? null : number,
      footprint,
      hint: key === hint,
      step: reachable ? { cost: isBack ? run.backCost : run.stepCost, back: isBack } : null,
    });
  };
  for (const opened of run.opened) add(opened.hex, opened.number, opened.footprint);
  add(run.start, null, false);
  if (run.chest) add(run.chest.hex, null, false);
  add(run.position, null, false);
  return {
    fog: fieldHexagon().filter((hex) => !seen.has(coordinateKey(hex))),
    hexes,
    position: run.position,
    pathLine: [run.start, ...run.path.map((step) => step.hex)],
    chest: run.chest ? run.chest.hex : null,
    walking,
    collect: run.phase === 'collect',
  };
}

export type FieldClick =
  { kind: 'step'; hex: IHexCoordinates } | { kind: 'back' } | { kind: 'chest' } | null;

export function resolveFieldClick(run: QuestProjection, hex: IHexCoordinates): FieldClick {
  if (run.phase !== 'walking') return null;
  const key = coordinateKey(hex);
  if (run.chest && key === coordinateKey(run.chest.hex)) return { kind: 'chest' };
  const back = previousHex(run);
  if (back && key === coordinateKey(back)) return { kind: 'back' };
  if (run.chest) return null;
  return { kind: 'step', hex };
}
