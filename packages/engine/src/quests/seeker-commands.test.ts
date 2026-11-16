import { describe, expect, it } from 'vitest';
import { deriveStream } from '../utils/random-seeded';
import { SEEKER_CARDS } from './seeker-content';
import { seekerProgress } from './seeker-test-setup';
import { createTreasureField, FIELD_RADIUS } from './treasure-field';
import { generateTrail } from './trail';
import {
  executeQuestRunCommand,
  parseQuestRunDoc,
  QUEST_RUN_COMMAND_SCHEMAS,
  type QuestRunDoc,
  type QuestRunOutcome,
} from './seeker-commands';
import { questBoardState } from './quest-log';
import { ALL_QUESTS } from './all-quests';
import { HERO, inventoryWith } from './quest-test-setup';
import { generatedEntrance } from './seeker-entrance-setup';

describe('REQ-QST-006 the trail on the real field', () => {
  for (const card of SEEKER_CARDS) {
    it(`${card.id}: every field of 300 seeds takes the trail`, () => {
      for (let i = 0; i < 300; i += 1) {
        const field = createTreasureField(`field-${i}`);
        expect(field.floor.length).toBeGreaterThan(80);
        const trail = generateTrail(
          field,
          field.start,
          card.params.steps,
          deriveStream(`f${i}`, 't'),
        );
        expect(trail, `seed ${i}`).not.toBeNull();
      }
    });
  }

  it('is a pure function of the seed with the start on the edge', () => {
    const a = createTreasureField('same');
    expect(JSON.stringify(createTreasureField('same'))).toBe(JSON.stringify(a));
    expect(
      a.floor.some(
        (hex) => hex.columnIndex === a.start.columnIndex && hex.rowIndex === a.start.rowIndex,
      ),
    ).toBe(true);
    expect(FIELD_RADIUS).toBeGreaterThan(3);
  });
});

function must(outcome: QuestRunOutcome) {
  if (!outcome.ok) throw new Error(`refused: ${outcome.code}`);
  return outcome;
}

const camp = {
  locationKey: 'camping' as const,
  mapId: 'm',
  coordinates: { columnIndex: 8, rowIndex: 7 },
};

function enter(seed = 's1') {
  const progress = { ...seekerProgress('seeker-1'), presence: camp };
  return must(
    executeQuestRunCommand({
      progress,
      doc: null,
      command: { type: 'QUEST_ENTER', payload: { heroId: HERO, questId: 'seeker-1' } },
      entrance: generatedEntrance(seed),
      newSeed: () => seed,
    }),
  );
}

describe('the seeker run commands', () => {
  it('leave the camp on ENTER, keep a document and give the camp back at the end', () => {
    const entered = enter();
    expect(entered.progress.presence).toBeNull();
    expect(entered.doc?.camp).toEqual(camp);

    const given = must(
      executeQuestRunCommand({
        progress: entered.progress,
        doc: entered.doc,
        command: { type: 'QUEST_GIVE_UP', payload: { heroId: HERO } },
        entrance: null,
        newSeed: () => 'x',
      }),
    );
    expect(given.doc).toBeNull();
    expect(given.progress.presence).toEqual(camp);
  });

  it('survive a save and load of the document and play on with the same numbers', () => {
    const entered = enter('s2');
    const restored = parseQuestRunDoc(JSON.stringify(entered.doc));
    expect(restored).toEqual(entered.doc);
    const step = (doc: QuestRunDoc | null, progress = entered.progress) =>
      must(
        executeQuestRunCommand({
          progress,
          doc,
          command: {
            type: 'QUEST_STEP',
            payload: { heroId: HERO, hex: restored.run.trail[0] },
          },
          entrance: null,
          newSeed: () => 'x',
        }),
      );
    expect(JSON.stringify(step(restored))).toBe(JSON.stringify(step(entered.doc)));
  });

  it.each(['QUEST_RETURN', 'QUEST_PAUSE'] as const)(
    'finishes a true run through %s and opens the next card',
    (type) => {
      let { progress, doc } = enter('s3');
      const send = (command: Parameters<typeof executeQuestRunCommand>[0]['command']) => {
        const out = must(
          executeQuestRunCommand({
            progress,
            doc,
            command,
            entrance: null,
            inventory: inventoryWith({}),
            newSeed: () => 'x',
          }),
        );
        progress = out.progress;
        doc = out.doc;
      };
      const trail = doc!.run.trail;
      for (const hex of trail.slice(0, -1))
        send({ type: 'QUEST_STEP', payload: { heroId: HERO, hex } });
      expect(progress.quests.active).toHaveLength(1);
      expect(progress.quests.done['seeker-1']).toBeUndefined();
      send({ type: 'QUEST_STEP', payload: { heroId: HERO, hex: trail.at(-1)! } });
      expect(progress.quests.active).toEqual([]);
      expect(progress.quests.done['seeker-1']).toBe(1);
      expect(doc!.run.resolution).toBe('treasure');
      send({ type: 'QUEST_OPEN_CHEST', payload: { heroId: HERO } });
      expect(doc!.run.phase).toBe('collect');
      if (type === 'QUEST_PAUSE') doc!.run.collect!.hero = doc!.run.start;
      send({ type, payload: { heroId: HERO } });
      if (type === 'QUEST_PAUSE') expect(doc?.suspended).toBe(true);
      else expect(doc).toBeNull();
      expect(progress.quests.done['seeker-1']).toBe(1);
      expect(progress.quests.active).toEqual([]);
      expect(progress.presence).toEqual(camp);
      expect(questBoardState(progress.quests, ALL_QUESTS['seeker-2'])).toBe('open');
      expect(questBoardState(progress.quests, ALL_QUESTS['seeker-3'])).toBe('locked');
    },
  );

  it('refuse a step without a run and a second ENTER while one is open', () => {
    const entered = enter();
    const noRun = executeQuestRunCommand({
      progress: entered.progress,
      doc: null,
      command: { type: 'QUEST_STEP_BACK', payload: { heroId: HERO } },
      entrance: null,
      newSeed: () => 'x',
    });
    expect(noRun).toMatchObject({ ok: false, code: 'NO_RUN' });
    const twice = executeQuestRunCommand({
      progress: { ...entered.progress, presence: camp },
      doc: entered.doc,
      command: { type: 'QUEST_ENTER', payload: { heroId: HERO, questId: 'seeker-1' } },
      entrance: generatedEntrance('y'),
      newSeed: () => 'y',
    });
    expect(twice).toMatchObject({ ok: false, code: 'QUEST_IN_PROGRESS' });
  });

  it('reject payloads with extra fields', () => {
    const bad = QUEST_RUN_COMMAND_SCHEMAS.QUEST_STEP.safeParse({
      type: 'QUEST_STEP',
      payload: { heroId: HERO, hex: { columnIndex: 1, rowIndex: 1 }, cost: 0 },
    });
    expect(bad.success).toBe(false);
  });
});

describe('leaving a resolved run through the door', () => {
  it('preserves normal pause behavior without changing the quest result', () => {
    const entered = enter();
    entered.doc!.run.phase = 'lost';
    entered.doc!.run.resolution = 'lost';
    entered.progress.quests.active = [];
    const send = (type: 'QUEST_PAUSE' | 'QUEST_GIVE_UP') =>
      executeQuestRunCommand({
        progress: entered.progress,
        doc: structuredClone(entered.doc),
        command: { type, payload: { heroId: HERO } },
        entrance: null,
        newSeed: () => 'unused',
      });
    const door = must(send('QUEST_PAUSE'));
    expect(door.doc?.suspended).toBe(true);
    expect(door.progress.presence).toEqual(camp);
    expect(door.progress.quests.active).toEqual([]);
    expect(door.progress.quests.done['seeker-1']).toBeUndefined();
    expect(door.events.map((event) => event.type)).toEqual(['QUEST_PAUSED']);
  });
});
