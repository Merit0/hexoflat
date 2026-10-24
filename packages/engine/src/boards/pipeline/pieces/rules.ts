import { z } from 'zod';
import { CONTENT } from '../../../content';
import { objectKeysWithTag } from '../../../content/content-accessors';
import { objectTagSchema } from '../../../content/content-schema';
import { hexobjectKeySchema } from '../../../content/content-schema';
import { EHexCollision } from '../../../abstraction/hexobject-abstraction';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../../../registry/hexobjects-registry';
import { coordinateKey, getHexNeighbors, hexDistance } from '../../../utils/hex-utils';
import { deriveStream, type SeededRandom } from '../../../utils/random-seeded';
import { parseCoordinateKey } from '../../board-cell-map';
import { checkGeneratedBoardReachable } from '../../board-reachability';
import type { BoardDraft, Piece } from '../types';

const CHANCE = /^(\d+)\/(\d+)$/;
const CONDITION = /^(>=|<=|>|<|=)?\s*(-?\d+)$/;

const intOrRange = z.union([
  z.number().int().min(0),
  z.tuple([z.number().int().min(0), z.number().int().min(0)]),
]);

const RuleSchema = z.object({
  id: z.string().min(1),
  pick: z.union([
    hexobjectKeySchema,
    z.array(hexobjectKeySchema).min(1),
    z.object({ tag: objectTagSchema }),
  ]),
  count: intOrRange,
  where: z
    .object({
      region: z.string().optional(),
      steps: z.tuple([z.number().int().min(0), z.number().int().min(0)]).optional(),
      spacing: z.number().int().min(0).optional(),
    })
    .default({}),
  chance: z.string().regex(CHANCE).optional(),
  when: z.record(z.string(), z.string().regex(CONDITION)).optional(),
});
type Rule = z.infer<typeof RuleSchema>;

const RulesParams = z.object({
  kind: z.literal('rules'),
  rules: z.array(RuleSchema).min(1),
});

function intBetween(min: number, max: number, rng: SeededRandom): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function conditionHolds(expression: string, actual: number): boolean {
  const match = CONDITION.exec(expression) as RegExpExecArray;
  const operator = match[1] ?? '=';
  const expected = Number(match[2]);
  switch (operator) {
    case '>=':
      return actual >= expected;
    case '<=':
      return actual <= expected;
    case '>':
      return actual > expected;
    case '<':
      return actual < expected;
    default:
      return actual === expected;
  }
}

function whenHolds(rule: Rule, params: Record<string, unknown>): string | null {
  for (const [name, expression] of Object.entries(rule.when ?? {})) {
    const actual = params[name];
    if (typeof actual !== 'number') return `parameter "${name}" is not set`;
    if (!conditionHolds(expression, actual)) return `"${name}" ${actual} fails ${expression}`;
  }
  return null;
}

function chanceHolds(chance: string, rng: SeededRandom): boolean {
  const match = CHANCE.exec(chance) as RegExpExecArray;
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  return Math.floor(rng() * denominator) < numerator;
}

function isFloor(draft: BoardDraft, coord: IHexCoordinates): boolean {
  const cell = draft.cellMap.get(coord);
  return !!cell?.exists && cell.hexobject?.hexobjectKey !== HEXOBJECT_KEYS.STONE_WALL;
}

function findEntryCoord(draft: BoardDraft): IHexCoordinates | undefined {
  for (const [key, cell] of draft.cellMap.entries()) {
    if (cell.hexobject && cell.hexobject.hexobjectKey === draft.entryObject) {
      return parseCoordinateKey(key);
    }
  }
  return undefined;
}

function floorStepsFrom(draft: BoardDraft, start: IHexCoordinates): Map<string, number> {
  const steps = new Map<string, number>([[coordinateKey(start), 0]]);
  let frontier = [start];
  while (frontier.length) {
    const next: IHexCoordinates[] = [];
    for (const current of frontier) {
      const distance = steps.get(coordinateKey(current)) as number;
      for (const neighbor of getHexNeighbors(current)) {
        const key = coordinateKey(neighbor);
        if (steps.has(key) || !isFloor(draft, neighbor)) continue;
        steps.set(key, distance + 1);
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  return steps;
}

function shuffled<T>(items: T[], rng: SeededRandom): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function eligibleCells(
  draft: BoardDraft,
  rule: Rule,
  steps: Map<string, number> | null,
  occupiedAtStart: Set<string>,
): IHexCoordinates[] {
  const source = rule.where.region
    ? draft.regions.filter((region) => region.role === rule.where.region).flatMap((r) => r.cells)
    : [...draft.cellMap.entries()].map(([key]) => parseCoordinateKey(key));

  return source
    .filter((cell) => isFloor(draft, cell) && !occupiedAtStart.has(coordinateKey(cell)))
    .filter((cell) => {
      if (!rule.where.steps) return true;
      const distance = steps?.get(coordinateKey(cell));
      return (
        distance !== undefined && distance >= rule.where.steps[0] && distance <= rule.where.steps[1]
      );
    })
    .sort((a, b) => a.rowIndex - b.rowIndex || a.columnIndex - b.columnIndex);
}

function keepsBoardReachable(draft: BoardDraft, entry: IHexCoordinates | undefined): boolean {
  if (!entry) return true;
  const targets: { coord: IHexCoordinates; label: string }[] = [];
  for (const [key, cell] of draft.cellMap.entries()) {
    if (cell.hexobject) {
      targets.push({ coord: parseCoordinateKey(key), label: cell.hexobject.hexobjectKey });
    }
  }
  return checkGeneratedBoardReachable(draft.cellMap, entry, targets).ok;
}

function resolveKeys(rule: Rule, count: number, rng: SeededRandom): THexobjectKey[] | null {
  const pool =
    typeof rule.pick === 'string'
      ? [rule.pick]
      : Array.isArray(rule.pick)
        ? rule.pick
        : objectKeysWithTag(rule.pick.tag);
  if (pool.length === 0) return null;
  return Array.from({ length: count }, () => pool[Math.floor(rng() * pool.length)]);
}

function placeRule(
  draft: BoardDraft,
  rule: Rule,
  seed: string,
  params: Record<string, unknown>,
  occupiedAtStart: Set<string>,
): void {
  const rng = deriveStream(seed, `objects:${rule.id}`);
  const trace = draft.trace;

  const blockedBy = whenHolds(rule, params);
  if (blockedBy) {
    trace.recordRule({ ruleId: rule.id, outcome: 'skipped', note: `when: ${blockedBy}` });
    return;
  }
  if (rule.chance && !chanceHolds(rule.chance, rng)) {
    trace.recordRule({
      ruleId: rule.id,
      outcome: 'skipped',
      note: `chance ${rule.chance} not rolled`,
    });
    return;
  }

  const wanted = Array.isArray(rule.count)
    ? intBetween(rule.count[0], rule.count[1], rng)
    : rule.count;
  const keys = resolveKeys(rule, wanted, rng);
  if (!keys) {
    trace.recordShortfall({
      ruleId: rule.id,
      wanted,
      placed: 0,
      reason: 'no object carries the requested tag',
    });
    trace.recordRule({
      ruleId: rule.id,
      outcome: 'short',
      note: 'no object carries the requested tag',
    });
    return;
  }

  const entry = findEntryCoord(draft);
  const steps = rule.where.steps && entry ? floorStepsFrom(draft, entry) : null;
  const candidates = shuffled(eligibleCells(draft, rule, steps, occupiedAtStart), rng);
  const spacing = rule.where.spacing ?? 0;
  const placedHere: IHexCoordinates[] = [];

  for (const cell of candidates) {
    if (placedHere.length === wanted) break;
    if (draft.cellMap.get(cell)?.hexobject) continue;
    if (placedHere.some((other) => hexDistance(other, cell) <= spacing)) continue;

    const key = keys[placedHere.length];
    const previous = draft.cellMap.get(cell);
    draft.cellMap.set(cell, { exists: true, hexobject: { hexobjectKey: key } });
    const solid = CONTENT[key]?.collision === EHexCollision.SOLID;
    if (solid && !keepsBoardReachable(draft, entry)) {
      if (previous) draft.cellMap.set(cell, previous);
      continue;
    }
    placedHere.push(cell);
    trace.record(cell, { stage: 'objects', pieceId: 'rules', ruleId: rule.id, note: key });
  }

  if (placedHere.length < wanted) {
    const reason = `placed ${placedHere.length} of ${wanted}: not enough free cells${
      rule.where.region ? ` in region "${rule.where.region}"` : ''
    } that keep the board reachable`;
    trace.recordShortfall({ ruleId: rule.id, wanted, placed: placedHere.length, reason });
    trace.recordRule({ ruleId: rule.id, outcome: 'short', note: reason });
    return;
  }
  trace.recordRule({ ruleId: rule.id, outcome: 'placed', note: `${wanted} placed` });
}

export const objectsRules: Piece<z.infer<typeof RulesParams>> = {
  id: 'rules',
  schema: RulesParams,
  tableRule:
    'Go down the list of rules in order; for each, roll its dice if it has any, then set out the stated number of tokens on free floor tiles in the stated room or distance band, never closing a path; if the table is too crowded, set out as many as fit and write down why.',
  run(draft, params, ctx) {
    const occupiedAtStart = new Set(
      [...draft.cellMap.entries()].filter(([, cell]) => cell.hexobject).map(([key]) => key),
    );
    for (const rule of params.rules) {
      placeRule(draft, rule, ctx.seed, ctx.params, occupiedAtStart);
    }
  },
};
