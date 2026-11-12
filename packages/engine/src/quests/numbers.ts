import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { RandomNumberGenerator } from '../utils/random';
import { deriveStream } from '../utils/random-seeded';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';
import { matchingNexts } from './sequences/alternatives';
import { decoyCandidates } from './sequences/decoys';
import { RULES, ruleKindOf, type RuleRegistry } from './sequences/rules';
import { floorKeys, positionOf, type QuestRun, type SeekerBoard } from './quest-state';

export interface RevealedHex {
  hex: IHexCoordinates;
  number: number;
}

export function expectedNumber(run: QuestRun, position: number): number | null {
  if (position < 1 || position > run.terms.length) return null;
  const line = run.lines[run.lines.length - 1];
  if (!line || position < line.fromStep) return run.terms[position - 1];
  return line.values[position - line.fromStep] ?? null;
}

function pathKey(run: QuestRun): string {
  const keys = [coordinateKey(run.start), ...run.path.map((step) => coordinateKey(step.hex))];
  return keys.join('>');
}

function pickOne<T>(items: readonly T[], random: RandomNumberGenerator): T {
  return items[Math.floor(random() * items.length)];
}

export function openNeighbors(
  run: QuestRun,
  at: IHexCoordinates,
  board: SeekerBoard,
): IHexCoordinates[] {
  const floor = floorKeys(board);
  const startKey = coordinateKey(run.start);
  return getHexNeighbors(at)
    .filter((hex) => {
      const key = coordinateKey(hex);
      return floor.has(key) && key !== startKey && !(key in run.revealed);
    })
    .sort((a, b) => coordinateKey(a).localeCompare(coordinateKey(b)));
}

function correctHexFor(
  run: QuestRun,
  closed: readonly IHexCoordinates[],
  position: number,
  random: RandomNumberGenerator,
): IHexCoordinates | null {
  if (position >= run.terms.length) return null;
  if (run.lines.length === 0) {
    const wanted = coordinateKey(run.trail[position]);
    return closed.find((hex) => coordinateKey(hex) === wanted) ?? null;
  }
  const trailKeys = new Set(run.trail.map(coordinateKey));
  trailKeys.add(coordinateKey(run.chestHex));
  const options = closed.filter((hex) => !trailKeys.has(coordinateKey(hex)));
  if (options.length === 0) return null;
  const follow = expectedNumber(run, position + 2);
  const quiet = options.filter(
    (hex) =>
      follow === null ||
      !getHexNeighbors(hex).some((n) => run.revealed[coordinateKey(n)]?.number === follow),
  );
  return pickOne(quiet.length > 0 ? quiet : options, random);
}

export interface RingResult {
  hexes: RevealedHex[];
  continuation: boolean;
}

function shuffled<T>(items: readonly T[], random: RandomNumberGenerator): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function areAdjacent(a: IHexCoordinates, b: IHexCoordinates): boolean {
  const key = coordinateKey(b);
  return getHexNeighbors(a).some((hex) => coordinateKey(hex) === key);
}

interface Placed {
  hex: IHexCoordinates;
  number: number;
  followUp: number | null;
}

export function revealRing(
  run: QuestRun,
  board: SeekerBoard,
  registry: RuleRegistry = RULES,
): RingResult {
  const at = positionOf(run);
  const closed = openNeighbors(run, at, board);
  if (closed.length === 0) return { hexes: [], continuation: false };
  const random = deriveStream(run.seed, `quest:${run.offerId}:numbers:${pathKey(run)}`);
  const position = run.path.length;
  const length = run.terms.length;
  const kind = ruleKindOf(run.rule, registry);
  const seen = run.path.map((step) => step.number);
  const lastValue = seen.length > 0 ? seen[seen.length - 1] : run.terms[0];
  const level = position + 1;
  const inRange = level <= length;
  const next = inRange
    ? (expectedNumber(run, level) as number)
    : kind.advance(run.rule, position, lastValue);
  const after = level + 1 <= length ? expectedNumber(run, level + 1) : null;
  const followUpOf = (value: number): number | null =>
    level < length ? kind.advance(run.rule, level, value) : null;

  const correct = correctHexFor(run, closed, position, random);
  const previousKey = coordinateKey(
    run.path.length > 1 ? run.path[run.path.length - 2].hex : run.start,
  );
  const placed: Placed[] = getHexNeighbors(at)
    .filter((hex) => coordinateKey(hex) in run.revealed && coordinateKey(hex) !== previousKey)
    .map((hex) => {
      const value = run.revealed[coordinateKey(hex)].number;
      return { hex, number: value, followUp: followUpOf(value) };
    });
  if (correct) placed.push({ hex: correct, number: next, followUp: after });

  const blocked = new Set(matchingNexts(seen));
  const taken = new Set<number>(placed.map((entry) => entry.number));
  const { close, far } = decoyCandidates(
    { rule: run.rule, step: level, seen, next, after, length, maxDigits: run.maxDigits },
    registry,
  );
  const pool = [...shuffled(close, random).slice(0, 2), ...shuffled([...close, ...far], random)];
  const limit = 10 ** run.maxDigits - 1;
  const fallback: number[] = [];
  for (let offset = 2; offset <= limit; offset += 1) fallback.push(next + offset, next - offset);

  const lookAhead = (hex: IHexCoordinates): Set<number> => {
    const forbidden = new Set<number>();
    if (run.lines.length > 0) return forbidden;
    for (let index = position; index + 1 < length; index += 1) {
      if (areAdjacent(hex, run.trail[index])) forbidden.add(run.terms[index + 1]);
    }
    return forbidden;
  };

  const acceptable = (hex: IHexCoordinates, value: number): boolean => {
    if (!Number.isInteger(value) || value < 1 || value > limit) return false;
    if (value === next || taken.has(value) || blocked.has(value)) return false;
    if (lookAhead(hex).has(value)) return false;
    const own = followUpOf(value);
    return placed.every((other) => {
      if (!areAdjacent(hex, other.hex)) return true;
      return value !== other.followUp && other.number !== own;
    });
  };

  const decoyHexes = closed.filter(
    (hex) => !correct || coordinateKey(hex) !== coordinateKey(correct),
  );
  const result: RevealedHex[] = [];
  for (const hex of decoyHexes) {
    const value = [...pool, ...fallback].find((candidate) => acceptable(hex, candidate));
    if (value === undefined) throw new Error('NO_DECOY_NUMBER');
    taken.add(value);
    placed.push({ hex, number: value, followUp: followUpOf(value) });
    result.push({ hex, number: value });
  }
  if (correct) result.push({ hex: correct, number: next });
  result.sort((a, b) => coordinateKey(a.hex).localeCompare(coordinateKey(b.hex)));
  return { hexes: result, continuation: correct !== null };
}
