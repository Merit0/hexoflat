import { describe, expect, it } from 'vitest';
import { TREASURE_SEEKER_MAP_KEY } from '@hexoflat/engine/registry/quest-map-key';
import type { QuestProjection } from '@hexoflat/engine/quests/projection';
import {
  FIELD_CENTER,
  FIELD_RADIUS,
  createTreasureField,
} from '@hexoflat/engine/quests/treasure-field';
import {
  axialToOffset,
  coordinateKey,
  getHexNeighbors,
  hexDistance,
} from '@hexoflat/engine/utils/hex-utils';
import {
  buildQuestField,
  previousHex,
  questHandAction,
  resolveFieldClick,
} from './quest-field-model';
import { questHoverObject } from './quest-hover-object';
import { captureQuestResult, questResult, resultFromEvents } from './quest-result';

const START = axialToOffset(FIELD_CENTER);

function boardOf(field: ReturnType<typeof createTreasureField>) {
  return {
    mapId: TREASURE_SEEKER_MAP_KEY,
    floor: [...field.floor],
    exit: field.exit,
    border: field.map.tiles.flatMap((tile) =>
      tile.regionId === 'border' && tile.hexobject
        ? [{ hex: tile.coordinates, objectKey: tile.hexobject.hexobjectKey }]
        : [],
    ),
  };
}
function projection(overrides: Partial<QuestProjection> = {}): QuestProjection {
  const [a, b] = getHexNeighbors(START);
  return {
    board: boardOf(createTreasureField('view-model')),
    offerId: 'seeker-1',
    phase: 'walking',
    outcome: null,
    start: START,
    position: START,
    path: [],
    opened: [
      { hex: a, number: 1, footprint: false },
      { hex: b, number: 7, footprint: false },
    ],
    hintHex: a,
    chest: null,
    stepCost: 1,
    backCost: 3,
    ...overrides,
  };
}

describe('reviewed numbers on map hexes', () => {
  it('maps final answer review by hex and leaves unchosen numbers neutral', () => {
    const [a, b, c] = getHexNeighbors(START);
    const run = projection({
      phase: 'lost',
      position: b,
      path: [
        { hex: a, number: 1 },
        { hex: b, number: 7 },
      ],
      opened: [
        { hex: a, number: 1, footprint: false },
        { hex: b, number: 7, footprint: false },
        { hex: c, number: 9, footprint: false },
      ],
      answerReview: [true, false],
    });
    const cells = buildQuestField(run).hexes;
    const at = (hex: typeof a) =>
      cells.find((cell) => coordinateKey(cell.hex) === coordinateKey(hex));
    expect(at(a)).toMatchObject({ number: 1, answerCorrect: true });
    expect(at(b)).toMatchObject({ number: 7, answerCorrect: false });
    expect(at(c)?.answerCorrect).toBeUndefined();
    expect(
      buildQuestField({ ...run, phase: 'walking', answerReview: undefined }).hexes.every(
        (cell) => cell.answerCorrect === undefined,
      ),
    ).toBe(true);
  });
});

describe('quest field model', () => {
  it('surrounds the numbered field with blockers and replaces exactly one border token with the camp door', () => {
    for (const seed of ['border-a', 'border-b', 'border-c']) {
      const field = createTreasureField(seed);
      const run = projection({
        board: boardOf(field),
        start: field.start,
        position: field.start,
        opened: [],
        hintHex: null,
      });
      const model = buildQuestField(run);
      expect(model.border).toHaveLength(42);
      expect(new Set(model.border.map(({ hex }) => coordinateKey(hex))).size).toBe(42);
      expect(model.border.every(({ hex }) => hexDistance(START, hex) === FIELD_RADIUS + 1)).toBe(
        true,
      );
      expect(model.border.filter(({ objectKey }) => objectKey === 'camping-entrance')).toEqual([
        { hex: model.exit, objectKey: 'camping-entrance' },
      ]);
      for (const border of model.border) {
        const object = questHoverObject(model, border.hex);
        expect(object?.hexobjectKey).toBe(border.objectKey);
        if (border.objectKey !== 'camping-entrance') {
          expect(['tree', 'rock']).toContain(border.objectKey);
          expect(object?.isInteractable).toBe(false);
          expect(questHandAction(run, border.hex)).toBeNull();
        }
        expect(
          model.hexes.some(({ hex }) => coordinateKey(hex) === coordinateKey(border.hex)),
        ).toBe(false);
      }
      expect(questHoverObject(model, field.start)).toBeNull();
    }
  });
  it('uses only server-generated floor for fog and never invents map geometry', () => {
    const run = projection();
    const model = buildQuestField(run);
    const open = new Set(model.hexes.map((cell) => coordinateKey(cell.hex)));
    expect(model.fog.every((hex) => !open.has(coordinateKey(hex)))).toBe(true);
    expect(model.fog.length + open.size).toBe(run.board!.floor.length);
  });

  it('prices open neighbours as steps and marks the hint', () => {
    const model = buildQuestField(projection());
    const [a, b] = getHexNeighbors(START);
    const first = model.hexes.find((cell) => coordinateKey(cell.hex) === coordinateKey(a));
    const second = model.hexes.find((cell) => coordinateKey(cell.hex) === coordinateKey(b));
    expect(first).toMatchObject({ hint: true, step: { cost: 1, back: false } });
    expect(second).toMatchObject({ hint: false, number: 7 });
  });

  it('prices the previous path hex as a step back', () => {
    const [a, b] = getHexNeighbors(START);
    const run = projection({
      position: a,
      path: [{ hex: a, number: 1 }],
      opened: [{ hex: b, number: 2, footprint: false }],
      hintHex: null,
    });
    expect(previousHex(run)).toEqual(START);
    const back = buildQuestField(run).hexes.find(
      (cell) => coordinateKey(cell.hex) === coordinateKey(START),
    );
    expect(back?.step).toEqual({ cost: 3, back: true });
  });

  it('draws no numbers and no steps while collecting', () => {
    const model = buildQuestField(projection({ phase: 'collect' }));
    expect(model.hexes.every((cell) => cell.number === null)).toBe(true);
    expect(model.walking).toBe(false);
    expect(model.collect).toBe(true);
  });

  it('resolves a click to step, back or nothing, never to an object', () => {
    const [a, b] = getHexNeighbors(START);
    const run = projection({
      position: a,
      path: [{ hex: a, number: 1 }],
      chest: { hex: b },
    });
    expect(resolveFieldClick(run, START)).toEqual({ kind: 'back' });
    expect(resolveFieldClick(run, b)).toBeNull();
    const free = getHexNeighbors(a).find(
      (hex) => ![START, b].some((other) => coordinateKey(other) === coordinateKey(hex)),
    )!;
    expect(resolveFieldClick({ ...run, chest: null }, free)).toMatchObject({ kind: 'step' });
    expect(resolveFieldClick(run, free)).toBeNull();
    expect(resolveFieldClick({ ...run, phase: 'ambush' }, b)).toBeNull();
  });

  it('the hand opens a chest and takes a stack only on an adjacent hex', () => {
    const [a, b] = getHexNeighbors(START);
    const run = projection({ chest: { hex: b } });
    expect(questHandAction(run, b)).toBe('eye');
    expect(questHandAction(run, a)).toBeNull();
    const far = getHexNeighbors(getHexNeighbors(getHexNeighbors(START)[0])[0])[0];
    expect(questHandAction(projection({ chest: { hex: far } }), far)).toBeNull();
    const collecting = projection({
      phase: 'collect',
      chest: { hex: START, empty: true },
      collect: { ground: [{ hex: b, itemKey: 'coins', amount: 3 }], seen: [a, b] },
    });
    expect(questHandAction(collecting, b)).toBe('take');
    expect(questHandAction(collecting, START)).toBeNull();
    expect(resolveFieldClick(collecting, b)).toBeNull();
    expect(questHandAction({ ...collecting, phase: 'lost' }, b)).toBeNull();
  });

  it('offers no steps while a chest stands on the field', () => {
    const [, b] = getHexNeighbors(START);
    const model = buildQuestField(projection({ chest: { hex: b } }));
    expect(model.hexes.filter((cell) => cell.step && !cell.step.back)).toHaveLength(0);
  });

  it('hovering shows the ordinary hexobject card data, nothing about a step', () => {
    const [a, b] = getHexNeighbors(START);
    const model = buildQuestField(projection());
    expect(questHoverObject(model, a)).toBeNull();
    const withChest = buildQuestField(projection({ chest: { hex: b } }));
    expect(questHoverObject(withChest, b)?.hexobjectKey).toBe('chest');
    const emptied = buildQuestField(projection({ chest: { hex: b, empty: true } }));
    expect(questHoverObject(emptied, b)?.hexobjectKey).toBe('chest-open');
    expect(questHoverObject(model, { columnIndex: 0, rowIndex: 0 })).toBeNull();
  });
});

describe('quest result', () => {
  const events = [
    {
      type: 'QUEST_FAILED',
      payload: {
        questId: 'seeker-1',
        reason: 'STRANDED',
        recap: { numbers: [1, 2], firstDeviation: { number: 9, expected: 3 } },
      },
    },
    { type: 'QUEST_SUMMARY', payload: { outcome: 'stranded' } },
  ];

  it('reads the outcome and the trail review from the closing events', () => {
    expect(resultFromEvents(events)).toEqual({
      questId: 'seeker-1',
      outcome: 'stranded',
      numbers: [1, 2],
      firstDeviation: { number: 9, expected: 3 },
    });
    expect(resultFromEvents([])).toBeNull();
  });

  it('keeps a result until it is dismissed', () => {
    captureQuestResult(events);
    expect(questResult.value?.outcome).toBe('stranded');
  });
});

describe('origin terrain on the quest field', () => {
  it('keeps mountains and water of the origin map visible and out of the fog', () => {
    const [mountain, water] = getHexNeighbors(START).slice(2, 4);
    const base = projection();
    const model = buildQuestField(
      projection({
        board: {
          ...base.board!,
          terrain: [
            { hex: mountain, terrain: 'mountain' },
            { hex: water, terrain: 'water' },
          ],
        },
      }),
    );
    expect(model.terrain).toEqual([
      { hex: mountain, terrain: 'mountain' },
      { hex: water, terrain: 'water' },
    ]);
    expect(model.hexes.some(({ hex }) => coordinateKey(hex) === coordinateKey(mountain))).toBe(
      false,
    );
  });

  it('draws no terrain for a run without it', () => {
    expect(buildQuestField(projection()).terrain).toEqual([]);
  });
});
