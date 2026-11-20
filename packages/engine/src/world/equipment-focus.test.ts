import { describe, expect, it } from 'vitest';
import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { emptyProgressState } from '../aggregates/progress-state';
import {
  battleWith,
  giveTurn,
  hero,
  rightAnswer,
  skeleton,
  wrongAnswer,
} from '../battle/battle-test-setup';
import { BATTLE_RULES } from '../battle/battle-content';
import { emptyInventoryState } from '../inventory/inventory-state';
import { upcastToken } from '../inventory/upcast-item-tokens';
import {
  battleWorld,
  createServerWorld,
  deserializeWorld,
  serializeWorld,
  type TravelRun,
  type BattleWorldOutcome,
} from './index';

function scene(value: number, equipped = true): TravelRun {
  const world = createServerWorld('cave', 'focus', 'seed', 'hero');
  world.battle = giveTurn(battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]), [
    'hero',
    's1',
  ]);
  const inventory = emptyInventoryState('hero');
  const item = {
    id: 'hero:focus',
    key: 'shield' as const,
    type: EHexobjectGroup.EQUIPMENT,
    amount: 1,
    token: { ...upcastToken('hero', 'focus', 'shield')!, attributes: [{ key: 'focus', value }] },
  };
  if (equipped) inventory.equip.shield = item;
  else inventory.bag[0] = item;
  const progress = emptyProgressState('hero');
  progress.knowledge.current = 10;
  return {
    world,
    progress,
    inventory,
    heroId: 'hero',
    now: 10_000,
    loadStored: () => null,
    loadById: () => null,
    create: (key) => createServerWorld(key, 'other', 'seed', 'hero'),
  };
}

function ok(result: BattleWorldOutcome) {
  if (!result.ok) throw new Error(result.code);
  return result;
}

function pushing(run: TravelRun): TravelRun {
  const result = ok(
    battleWorld(run, { kind: 'hero', heroId: 'hero', action: { kind: 'push', targetId: 's1' } }),
  );
  return { ...run, ...result };
}

function answer(run: TravelRun, correct = true, now = run.now + 100) {
  const option = correct ? rightAnswer(run.world.battle!) : wrongAnswer(run.world.battle!);
  return battleWorld(
    { ...run, now },
    { kind: 'hero', heroId: 'hero', action: { kind: 'answer-task', option } },
  );
}

describe('A05 battle Focus restores the hero Will reserve', () => {
  it.each([1, 4, 5])('grants +%s once and preserves the reward after a reload', (value) => {
    const run = pushing(scene(value));
    const turnWill = run.world.battle!.turnWill;
    run.world = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(run.world))), 0);
    const result = ok(answer(run));
    expect(result.progress.knowledge).toMatchObject({ current: 10 + value, revision: 1 });
    expect(result.world.battle!.turnWill).toBe(turnWill);
    expect(result.events.filter((event) => event.type === 'WILL_GRANTED')).toMatchObject([
      { payload: { amount: value, source: { kind: 'task' } } },
    ]);
    expect(
      result.steps.flatMap((step) => step.events).filter((event) => event.type === 'WILL_GRANTED'),
    ).toHaveLength(1);
    const repeated = battleWorld(
      { ...run, ...result, now: run.now + 200 },
      { kind: 'hero', heroId: 'hero', action: { kind: 'answer-task', option: 0 } },
    );
    expect(repeated).toMatchObject({ ok: false, code: 'NO_TASK' });
    expect(result.progress.knowledge.current).toBe(10 + value);
  });

  it('gives nothing for a bag bonus, a wrong answer or an expired task', () => {
    const bag = ok(answer(pushing(scene(4, false))));
    const wrong = ok(answer(pushing(scene(4)), false));
    const late = pushing(scene(4));
    const timedOut = ok(
      battleWorld(
        { ...late, now: late.world.battle!.task!.deadlineMs + BATTLE_RULES.networkGraceMs + 1 },
        { kind: 'sync', heroId: 'hero' },
      ),
    );
    for (const result of [bag, wrong, timedOut]) {
      expect(result.progress.knowledge.current).toBe(10);
      expect(result.events.some((event) => event.type === 'WILL_GRANTED')).toBe(false);
    }
  });

  it('caps the equipped sum at five and does not overfill capacity', () => {
    const run = scene(4);
    run.inventory.equip.weapon = { ...run.inventory.equip.shield!, id: 'hero:other' };
    expect(ok(answer(pushing(run))).progress.knowledge.current).toBe(15);
    run.progress.knowledge.current = 49;
    const result = ok(answer(pushing(run)));
    expect(result.progress.knowledge.current).toBe(50);
    expect(result.events.filter((event) => event.type === 'WILL_GRANTED')).toMatchObject([
      { payload: { amount: 1 } },
    ]);
  });
});
