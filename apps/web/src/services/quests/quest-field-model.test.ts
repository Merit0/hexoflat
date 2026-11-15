import { describe, expect, it } from 'vitest';
import type { QuestProjection } from '@hexoflat/engine/quests/projection';
import { FIELD_CENTER } from '@hexoflat/engine/quests/treasure-field';
import { axialToOffset, coordinateKey, getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import {
  buildQuestField,
  fieldHexagon,
  previousHex,
  questHandAction,
  questToolHexAt,
  resolveFieldClick,
} from './quest-field-model';
import { questHoverObject } from './quest-hover-object';
import { captureQuestResult, questResult, resultFromEvents } from './quest-result';

const START = axialToOffset(FIELD_CENTER);

function projection(overrides: Partial<QuestProjection> = {}): QuestProjection {
  const [a, b] = getHexNeighbors(START);
  return {
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

describe('quest field model', () => {
  it('covers a radius-6 hexagon of 127 hexes with fog where nothing is open', () => {
    expect(fieldHexagon()).toHaveLength(127);
    const model = buildQuestField(projection());
    const open = new Set(model.hexes.map((cell) => coordinateKey(cell.hex)));
    expect(model.fog.every((hex) => !open.has(coordinateKey(hex)))).toBe(true);
    expect(model.fog.length + open.size).toBe(127);
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

  it('the tool hex snaps to the hero neighbour nearest to the pointer', () => {
    const [a] = getHexNeighbors(START);
    expect(questToolHexAt(projection(), a)).toEqual(a);
    expect(questToolHexAt(projection(), null)).toEqual(getHexNeighbors(START)[0]);
    expect(questToolHexAt(projection({ phase: 'lost' }), a)).toBeNull();
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
