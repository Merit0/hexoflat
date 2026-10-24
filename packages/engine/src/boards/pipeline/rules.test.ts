import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS } from '../../registry/hexobjects-registry';
import { objectKeysWithTag } from '../../content/content-accessors';
import type { BoardRecipeInput } from '../../content/boards/recipe-schema';
import { BOARD_COLUMNS, BOARD_ROWS } from '../board-size';
import { coordinateKey } from '../../utils/hex-utils';
import { runBoardPipeline, type PipelineBoard } from './run-board-pipeline';
import { summarizeRules } from './trace';

type RuleInput = Record<string, unknown>;

function caveWith(rules: RuleInput[]): BoardRecipeInput {
  return {
    id: 'rules-probe',
    version: 1,
    kind: 'generated',
    frame: { columns: BOARD_COLUMNS, rows: BOARD_ROWS },
    background: '',
    fog: 'FOG',
    entryObject: HEXOBJECT_KEYS.CAVE_EXIT,
    stages: {
      form: [{ kind: 'blobs', count: [4, 5], radius: 2, link: 'branch' }],
      bounds: [{ kind: 'wall', enclose: true }],
      gates: [{ kind: 'entry' }],
      objects: [{ kind: 'rules', rules }],
      checks: [{ kind: 'shape', minRegions: 4 }, { kind: 'reachable' }],
    },
  };
}

const ROCKS: RuleInput = {
  id: 'rocks',
  pick: HEXOBJECT_KEYS.ROCK,
  count: [3, 6],
  where: { steps: [2, 12], spacing: 1 },
};
const REST: RuleInput = {
  id: 'rest',
  pick: { tag: 'rest' },
  count: [1, 2],
  where: { region: 'room' },
};
const TREASURE: RuleInput = {
  id: 'treasure',
  pick: { tag: 'treasure' },
  count: 1,
  where: { region: 'deep' },
};
const GUARD: RuleInput = {
  id: 'guard',
  pick: HEXOBJECT_KEYS.SKELETOR,
  count: [1, 2],
  where: { region: 'deep' },
};
const ALL_RULES = [ROCKS, REST, TREASURE, GUARD];

function cellsOfRule(built: PipelineBoard, ruleId: string): string[] {
  return built.map.tiles
    .filter((tile) =>
      built.trace.entriesAt(tile.coordinates).some((entry) => entry.ruleId === ruleId),
    )
    .map((tile) => coordinateKey(tile.coordinates))
    .sort();
}

describe('OBJECTS:rules', () => {
  it('OBJECTS:rules tags resolve through the catalog', () => {
    expect(objectKeysWithTag('rest')).toEqual(
      expect.arrayContaining([HEXOBJECT_KEYS.FIREPLACE, HEXOBJECT_KEYS.HEALING_SPRING]),
    );
    expect(objectKeysWithTag('treasure')).toContain(HEXOBJECT_KEYS.CHEST);
  });

  it('OBJECTS:rules every rule is fully done or has a reason in the trace (REQ-BOARD-006, REQ-BOARD-004) over 500 seeds', () => {
    for (let i = 0; i < 500; i += 1) {
      const built = runBoardPipeline(caveWith(ALL_RULES), { seed: `r6-${i}` });
      expect(built.trace.ruleOutcomes.map((outcome) => outcome.ruleId)).toEqual(
        ALL_RULES.map((rule) => rule.id),
      );
      for (const outcome of built.trace.ruleOutcomes) {
        const placed = cellsOfRule(built, outcome.ruleId).length;
        const shortfall = built.trace.shortfalls.find((item) => item.ruleId === outcome.ruleId);
        if (outcome.outcome === 'short') {
          expect(shortfall?.reason.length).toBeGreaterThan(0);
          expect(placed).toBe(shortfall?.placed);
        } else if (outcome.outcome === 'placed') {
          expect(shortfall).toBeUndefined();
          expect(placed).toBeGreaterThan(0);
        } else {
          expect(placed).toBe(0);
        }
      }
    }
  });

  it('OBJECTS:rules respects region, steps and spacing', () => {
    for (let i = 0; i < 100; i += 1) {
      const built = runBoardPipeline(caveWith(ALL_RULES), { seed: `where-${i}` });
      const deepCells = new Set(
        built.regions
          .filter((region) => region.role === 'deep')
          .flatMap((region) => region.cells.map(coordinateKey)),
      );
      for (const key of [...cellsOfRule(built, 'treasure'), ...cellsOfRule(built, 'guard')]) {
        expect(deepCells.has(key)).toBe(true);
      }
      const rocks = cellsOfRule(built, 'rocks');
      expect(built.measures?.stepsToObject[HEXOBJECT_KEYS.ROCK]).not.toBeNull();
      expect(new Set(rocks).size).toBe(rocks.length);
    }
  });

  it('OBJECTS:rules chance 1/6 fires in 13–20% of 600 seeds (REQ-BOARD-007)', () => {
    const rare: RuleInput = {
      id: 'rare',
      pick: HEXOBJECT_KEYS.HEALING_SPRING,
      count: 1,
      where: { region: 'deep' },
      chance: '1/6',
    };
    let fired = 0;
    const seeds = 600;
    for (let i = 0; i < seeds; i += 1) {
      const built = runBoardPipeline(caveWith([rare]), { seed: `chance-${i}` });
      if (built.trace.ruleOutcomes[0].outcome === 'placed') fired += 1;
    }
    expect(fired / seeds).toBeGreaterThanOrEqual(0.13);
    expect(fired / seeds).toBeLessThanOrEqual(0.2);
  });

  it('OBJECTS:rules gives the same board for the same seed and params (REQ-BOARD-007)', () => {
    const first = runBoardPipeline(caveWith(ALL_RULES), { seed: 'same', params: { tier: 2 } });
    const again = runBoardPipeline(caveWith(ALL_RULES), { seed: 'same', params: { tier: 2 } });
    expect(again.map.toJSON()).toEqual(first.map.toJSON());
  });

  it('OBJECTS:rules when gates a rule on the encounter parameters', () => {
    const elite: RuleInput = {
      id: 'elite',
      pick: { tag: 'enemy' },
      count: 1,
      where: { region: 'deep' },
      when: { tier: '>=3' },
    };
    const low = runBoardPipeline(caveWith([elite]), { seed: 'w', params: { tier: 2 } });
    const high = runBoardPipeline(caveWith([elite]), { seed: 'w', params: { tier: 3 } });
    const unset = runBoardPipeline(caveWith([elite]), { seed: 'w' });

    expect(low.trace.ruleOutcomes[0].outcome).toBe('skipped');
    expect(unset.trace.ruleOutcomes[0].outcome).toBe('skipped');
    expect(high.trace.ruleOutcomes[0].outcome).toBe('placed');
  });

  it('OBJECTS:rules reports a shortfall instead of failing when a region is too small (REQ-BOARD-006)', () => {
    const crowd: RuleInput = {
      id: 'crowd',
      pick: HEXOBJECT_KEYS.ROCK,
      count: 400,
      where: { region: 'deep' },
    };
    const built = runBoardPipeline(caveWith([crowd]), { seed: 'crowd' });
    const shortfall = built.trace.shortfalls[0];

    expect(shortfall.ruleId).toBe('crowd');
    expect(shortfall.placed).toBeLessThan(shortfall.wanted);
    expect(shortfall.reason).toMatch(/region "deep"/);
  });
});

describe('OBJECTS:rules independence (REQ-BOARD-010)', () => {
  function pair(seed: string, rules: (rocks: RuleInput) => RuleInput[]) {
    const few = runBoardPipeline(caveWith(rules({ ...ROCKS, count: 1 })), { seed });
    const many = runBoardPipeline(caveWith(rules({ ...ROCKS, count: 8 })), { seed });
    const sameAttempt =
      few.descriptor.kind === 'RECIPE' &&
      many.descriptor.kind === 'RECIPE' &&
      few.descriptor.attempt === many.descriptor.attempt;
    return sameAttempt ? { few, many } : null;
  }

  it('OBJECTS:rules a rule listed last cannot move any earlier rule object', () => {
    let compared = 0;
    for (let i = 0; i < 200; i += 1) {
      const result = pair(`r10-last-${i}`, (rocks) => [REST, TREASURE, GUARD, rocks]);
      if (!result) continue;
      compared += 1;
      for (const ruleId of ['rest', 'treasure', 'guard']) {
        expect(cellsOfRule(result.many, ruleId)).toEqual(cellsOfRule(result.few, ruleId));
      }
    }
    expect(compared).toBeGreaterThan(150);
  });

  it('OBJECTS:rules a rule listed first moves other objects only when it takes their cell or would cut a path', () => {
    let kept = 0;
    let total = 0;
    for (let i = 0; i < 200; i += 1) {
      const result = pair(`r10-first-${i}`, (rocks) => [rocks, REST, TREASURE, GUARD]);
      if (!result) continue;
      const takenByRocks = new Set(cellsOfRule(result.many, 'rocks'));
      for (const ruleId of ['rest', 'treasure', 'guard']) {
        const after = new Set(cellsOfRule(result.many, ruleId));
        for (const cell of cellsOfRule(result.few, ruleId)) {
          total += 1;
          if (after.has(cell) || takenByRocks.has(cell)) kept += 1;
        }
      }
    }
    expect(kept / total).toBeGreaterThanOrEqual(0.85);
  });
});

describe('summarizeRules', () => {
  it('summarizeRules reports wanted, placed and a note for every rule', () => {
    const crowd: RuleInput = {
      id: 'crowd',
      pick: HEXOBJECT_KEYS.ROCK,
      count: 400,
      where: { region: 'deep' },
    };
    const built = runBoardPipeline(caveWith([ROCKS, crowd]), { seed: 'summary' });
    const [rocks, crowded] = summarizeRules(built.trace);

    expect(rocks.outcome).toBe('placed');
    expect(rocks.placed).toBe(rocks.wanted);
    expect(crowded.outcome).toBe('short');
    expect(crowded.wanted).toBe(400);
    expect(crowded.placed).toBeLessThan(400);
    expect(crowded.note).toMatch(/region "deep"/);
  });
});
