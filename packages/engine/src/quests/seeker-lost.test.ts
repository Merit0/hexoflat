import { describe, expect, it } from 'vitest';
import { LOOT_TABLES } from '../content/loot-tables.content';
import { emptyInventoryState } from '../inventory/inventory-state';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';
import { projectQuestForClient } from './projection';
import { floorKeys, parseQuestRun, positionOf } from './quest-state';
import {
  seekerGiveUp,
  seekerOpenChest,
  seekerStep,
  seekerStepBack,
  type SeekerOptions,
} from './seeker-actions';
import { generateChestDrop } from './seeker-chest';
import { SEEKER_CARDS, SEEKER_RULES, seekerCardFailures } from './seeker-content';
import { SEEKER_CATALOGUE } from './seeker-quests';
import {
  decoyHexAround,
  followTruth,
  must,
  openChestOf,
  startQuest,
  type Started,
} from './seeker-test-setup';
import { enterQuest } from './seeker-actions';
import { seekerProgress } from './seeker-test-setup';
import { createTreasureField } from './treasure-field';

const OFF: SeekerOptions = { ambushEnabled: false };
const ON: SeekerOptions = { ambushEnabled: true };

function walkFalseTrail(state: Started, deviateAt: number, options: SeekerOptions) {
  let { progress, run } = state;
  const events: ReturnType<typeof must>['events'] = [];
  const truth = followTruth(state, deviateAt - 1);
  ({ progress, run } = truth);
  events.push(...truth.events);
  let moved = must(seekerStep(progress, run, decoyHexAround(run), state.board, options));
  ({ progress, run } = moved);
  events.push(...moved.events);
  let guard = 0;
  while (!run.chest && run.phase === 'walking' && guard < 14) {
    const line = run.lines[run.lines.length - 1];
    const next = line.values[run.path.length + 1 - line.fromStep];
    const hex = getHexNeighbors(positionOf(run)).find(
      (candidate) => run.revealed[coordinateKey(candidate)]?.number === next,
    );
    if (!hex) break;
    moved = must(seekerStep(progress, run, hex, state.board, options));
    ({ progress, run } = moved);
    events.push(...moved.events);
    guard += 1;
  }
  return { progress, run, events };
}

function falseTrails(options: SeekerOptions) {
  const results: {
    length: number;
    seed: string;
    state: Started;
    end: ReturnType<typeof walkFalseTrail>;
  }[] = [];
  for (let at = 1; at <= 10; at += 1) {
    for (let i = 0; i < 40; i += 1) {
      const seed = `lost-${at}-${i}`;
      const state = startQuest('seeker-1', seed);
      try {
        results.push({ length: at, seed, state, end: walkFalseTrail(state, at, options) });
      } catch {
        continue;
      }
    }
  }
  return results;
}

describe('REQ-QST-036 a false trail ends in a lost treasure when the ambush is off', () => {
  it('the shipped flag is off', () => {
    expect(SEEKER_RULES.ambushEnabled).toBe(false);
  });

  it('every deviation point from step 1 to L ends in QUEST_LOST with no chest anywhere', () => {
    const covered = new Set<number>();
    for (const { length, end } of falseTrails(OFF)) {
      covered.add(length);
      expect(end.run.phase).toBe('lost');
      expect(end.run.chest).toBeNull();
      expect(end.events.filter((event) => event.type === 'CHEST_APPEARED')).toEqual([]);
      const lost = end.events.filter((event) => event.type === 'QUEST_LOST');
      expect(lost).toHaveLength(1);
      expect(lost[0].payload).toMatchObject({ reason: 'TREASURE_LOST' });
      expect(projectQuestForClient(end.run).chest).toBeNull();
    }
    expect([...covered].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('only leaving is accepted; it frees the slot, refunds nothing and counts no milestone', () => {
    const { state, end } = (() => {
      const found = falseTrails(OFF).find((entry) => entry.end.run.phase === 'lost')!;
      return { state: found.state, end: found.end };
    })();
    expect(seekerStep(end.progress, end.run, end.run.start, state.board)).toMatchObject({
      reason: 'WRONG_PHASE',
    });
    expect(seekerStepBack(end.progress, end.run, state.board)).toMatchObject({
      reason: 'WRONG_PHASE',
    });
    expect(openChestOf(state, end)).toMatchObject({ reason: 'WRONG_PHASE' });
    const left = must(seekerGiveUp(end.progress, end.run));
    expect(left.run.phase).toBe('ended');
    expect(left.run.outcome).toBe('lost');
    expect(left.progress.quests.active).toEqual([]);
    expect(left.progress.quests.done['seeker-1']).toBeUndefined();
    expect(left.progress.knowledge.current).toBe(end.progress.knowledge.current);
    expect(left.events.map((event) => event.type)).toEqual(['QUEST_FAILED', 'QUEST_SUMMARY']);
    expect(left.events[0].payload).toMatchObject({ reason: 'TREASURE_LOST' });
  });

  it('a step onto a deviation hex tells nothing until the lost event', () => {
    const state = startQuest('seeker-1', 'indistinct');
    const truth = must(seekerStep(state.progress, state.run, state.run.trail[0], state.board, OFF));
    const wrong = must(
      seekerStep(state.progress, state.run, decoyHexAround(state.run), state.board, OFF),
    );
    const shape = (events: typeof truth.events) => events.map((event) => event.type);
    expect(shape(wrong.events)).toEqual(shape(truth.events));
    expect(wrong.run.phase).toBe('walking');
  });
});

describe('REQ-QST-037 with the ambush on, the lure chest behaves as before', () => {
  it('a false trail still ends in a lure chest and OPEN springs the ambush', () => {
    const found = falseTrails(ON).find((entry) => entry.end.run.chest?.kind === 'lure')!;
    expect(found.end.run.phase).toBe('walking');
    expect(found.end.events.map((event) => event.type)).toContain('CHEST_APPEARED');
    expect(found.end.events.map((event) => event.type)).not.toContain('QUEST_LOST');
    const sprung = must(openChestOf(found.state, found.end));
    expect(sprung.run.phase).toBe('ambush');
  });
});

describe('REQ-QST-038 the chest drop is generated once and stays hidden', () => {
  function atChest(seed: string, id = 'seeker-1') {
    const state = startQuest(id, seed);
    const steps = SEEKER_CARDS.find((card) => card.id === id)!.params.steps;
    return { state, end: followTruth(state, steps) };
  }

  it('is stored when the chest appears and is the same before OPEN, after a reload and after a refused OPEN', () => {
    const { state, end } = atChest('drop-a');
    const stored = JSON.stringify(end.run.chest!.drop);
    expect(end.run.chest!.drop).toHaveLength(4);
    const reloaded = parseQuestRun(JSON.parse(JSON.stringify(end.run)));
    expect(JSON.stringify(reloaded.chest!.drop)).toBe(stored);
    const refused = seekerOpenChest(end.progress, end.run, state.board, {
      inventory: undefined,
      tableId: 'seeker-1-chest-loot',
    });
    expect(refused).toMatchObject({ ok: false, reason: 'NO_INVENTORY' });
    expect(JSON.stringify(end.run.chest!.drop)).toBe(stored);
    const opened = must(openChestOf(state, end));
    expect(opened.run.chest!.drop).toEqual(end.run.chest!.drop);
    expect([...opened.run.collect!.ground.map((item) => item.itemKey)].sort()).toEqual(
      end.run.chest!.drop!.map((entry) => entry.itemKey).sort(),
    );
  });

  it('never reaches the projection', () => {
    const { end } = atChest('drop-b');
    const text = JSON.stringify(projectQuestForClient(end.run));
    expect(text).not.toMatch(/drop|sword|shield|bottle|table|guaranteed/i);
  });

  it('10 000 generations for every card are never empty and hold the four guaranteed items', () => {
    for (const card of SEEKER_CARDS) {
      for (let i = 0; i < 10_000; i += 1) {
        const drop = generateChestDrop({
          seed: `gen-${i}`,
          chestHex: { columnIndex: 12, rowIndex: 12 },
          tableId: card.params.chestLootTableId,
        });
        expect(drop.length, `${card.id} ${i}`).toBeGreaterThan(0);
        expect(drop.map((entry) => entry.itemKey).sort()).toEqual(
          [
            HEXOBJECT_KEYS.SWORD,
            HEXOBJECT_KEYS.SHIELD,
            HEXOBJECT_KEYS.HEALTH_BOTTLE,
            HEXOBJECT_KEYS.MANA_BOTTLE,
          ].sort(),
        );
      }
    }
  });

  for (const card of SEEKER_CARDS) {
    it(`${card.id}: 500 real fields, all four items lie on the field and nothing goes to the bag`, () => {
      for (let i = 0; i < 500; i += 1) {
        const seed = `all-four-${card.id}-${i}`;
        const field = createTreasureField(seed);
        const entered = must(
          enterQuest(seekerProgress(card.id), {
            questId: card.id,
            catalogue: SEEKER_CATALOGUE,
            seed,
            board: field,
            start: field.start,
            atBoard: true,
            hasRun: false,
          }),
        );
        const state = { progress: entered.progress, run: entered.run, board: field };
        const end = followTruth(state, card.params.steps);
        const opened = must(
          seekerOpenChest(end.progress, end.run, field, {
            inventory: emptyInventoryState('hero-1'),
            tableId: card.params.chestLootTableId,
          }),
        );
        expect(opened.run.collect!.ground, `seed ${i}`).toHaveLength(4);
        const floor = floorKeys(field);
        for (const item of opened.run.collect!.ground) {
          expect(floor.has(coordinateKey(item.hex))).toBe(true);
        }
        const toBag = opened.events.find((event) => event.type === 'CONTAINER_OPENED')!.payload as {
          toBag: unknown[];
        };
        expect(toBag.toBag, `seed ${i}`).toEqual([]);
      }
    });
  }
});

describe('REQ-QST-039 seeker chest table validation', () => {
  it('rejects a table with more than five guaranteed entries or one that can yield nothing', () => {
    const base = LOOT_TABLES[SEEKER_CARDS[0].params.chestLootTableId];
    expect(seekerCardFailures()).toEqual([]);
    const six = {
      ...base,
      guaranteed: Array.from({ length: 6 }, () => base.guaranteed![0]),
    };
    const nothing = { ...base, guaranteed: [], rolls: [0, 0] as [number, number], entries: [] };
    for (const [id, table] of [
      ['six', six],
      ['nothing', nothing],
    ] as const) {
      const card = {
        ...SEEKER_CARDS[0],
        params: { ...SEEKER_CARDS[0].params, chestLootTableId: `seeker-test-${id}` },
      };
      (LOOT_TABLES as Record<string, unknown>)[`seeker-test-${id}`] = table;
      const failures = seekerCardFailures([card]);
      delete (LOOT_TABLES as Record<string, unknown>)[`seeker-test-${id}`];
      expect(failures.join('|')).toMatch(id === 'six' ? /more than 5 guaranteed/ : /yield nothing/);
    }
  });
});
