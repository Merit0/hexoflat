import { describe, expect, it } from 'vitest';
import type { QuestProjection } from '@hexoflat/engine/quests/projection';
import { FIELD_CENTER } from '@hexoflat/engine/quests/treasure-field';
import { axialToOffset, coordinateKey, getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { buildQuestField, fieldHexagon, previousHex, resolveFieldClick } from './quest-field-model';
import { buildQuestHexTip } from './quest-hex-tip';
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

  it('resolves a click to step, back, chest or nothing', () => {
    const [a, b] = getHexNeighbors(START);
    const run = projection({
      position: a,
      path: [{ hex: a, number: 1 }],
      chest: { hex: b },
    });
    expect(resolveFieldClick(run, START)).toEqual({ kind: 'back' });
    expect(resolveFieldClick(run, b)).toEqual({ kind: 'chest' });
    const free = getHexNeighbors(a).find(
      (hex) => ![START, b].some((other) => coordinateKey(other) === coordinateKey(hex)),
    )!;
    expect(resolveFieldClick({ ...run, chest: null }, free)).toMatchObject({ kind: 'step' });
    expect(resolveFieldClick(run, free)).toBeNull();
    expect(resolveFieldClick({ ...run, phase: 'collect' }, b)).toBeNull();
  });

  it('offers no steps while a chest stands on the field', () => {
    const [, b] = getHexNeighbors(START);
    const model = buildQuestField(projection({ chest: { hex: b } }));
    expect(model.hexes.filter((cell) => cell.step && !cell.step.back)).toHaveLength(0);
  });

  it('explains a step, a step back and the chest on hover', () => {
    const [a, b] = getHexNeighbors(START);
    const model = buildQuestField(projection());
    expect(buildQuestHexTip(model, a)).toEqual({ key: 'quest.tip.step', params: { n: 1 } });
    expect(buildQuestHexTip(buildQuestField(projection({ chest: { hex: b } })), b)).toEqual({
      key: 'quest.tip.chest',
      params: {},
    });
    expect(buildQuestHexTip(model, { columnIndex: 0, rowIndex: 0 })).toBeNull();
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
