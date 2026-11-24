import { dimensionOfTokenType, type EDimension } from '../dimensions/dimensions';
import type { ItemToken } from '../tokens/token-schema';
import { questDropContext } from './quest-drop-context';
import { seekerBoardOf } from './cloned-field';
import type { TerrainId } from '../boards/terrain';
import type { TreasureSeekerMapKey } from '../registry/quest-map-key';
import { TREASURE_SEEKER_MAP_KEY } from '../registry/quest-map-key';
import { questAnswerReview } from './quest-answer-review';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { coordinateKey } from '../utils/hex-utils';
import { positionOf, type QuestRun, type SeekerOutcome } from './quest-state';
import { projectQuestOffer, type QuestOfferProjection } from './quest-board-projection';

export interface QuestBoardProjection {
  mapId: TreasureSeekerMapKey;
  background?: string;
  floor: IHexCoordinates[];
  border: { hex: IHexCoordinates; objectKey: THexobjectKey }[];
  terrain?: { hex: IHexCoordinates; terrain: TerrainId }[];
  exit: IHexCoordinates;
}

export interface QuestProjection {
  board?: QuestBoardProjection;
  offerId: string;
  offer?: QuestOfferProjection;
  dimension?: EDimension;
  phase: QuestRun['phase'];
  outcome: SeekerOutcome | null;
  start: IHexCoordinates;
  position: IHexCoordinates;
  path: { hex: IHexCoordinates; number: number }[];
  opened: { hex: IHexCoordinates; number: number; footprint: boolean }[];
  hintHex: IHexCoordinates | null;
  chest: { hex: IHexCoordinates; empty?: boolean } | null;
  collect?: {
    ground: { hex: IHexCoordinates; itemKey: string; amount: number; token?: ItemToken }[];
    seen: IHexCoordinates[];
  } | null;
  stepCost: number;
  backCost: number;
  answerReview?: boolean[];
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
  const field = seekerBoardOf(run);
  const answerReview = questAnswerReview(run);
  return {
    board: {
      mapId: TREASURE_SEEKER_MAP_KEY,
      background: field.background,
      floor: [...field.floor],
      border: field.border.map(({ hex, objectKey }) => ({ hex: { ...hex }, objectKey })),
      ...(field.blocked.length
        ? { terrain: field.blocked.map(({ hex, terrain }) => ({ hex: { ...hex }, terrain })) }
        : {}),
      exit: field.exit,
    },
    offerId: run.offerId,
    ...(run.generatedOffer ? { offer: projectQuestOffer(run.generatedOffer) } : {}),
    dimension: dimensionOfTokenType(questDropContext(run).tokenType),
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
    chest: run.chest ? { hex: run.chest.hex, empty: run.collect !== null } : null,
    collect: run.collect
      ? {
          ground: run.collect.ground.map(({ hex, itemKey, amount, token }) => ({
            hex: { ...hex },
            itemKey,
            amount,
            ...(token ? { token: structuredClone(token) } : {}),
          })),
          seen: run.collect.seen.map(parseKey),
        }
      : null,
    stepCost: run.stepCost,
    backCost: run.stepCost * run.backMultiplier,
    ...(answerReview ? { answerReview } : {}),
  };
}
