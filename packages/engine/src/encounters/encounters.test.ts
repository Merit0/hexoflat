import { describe, expect, it } from 'vitest';
import { findEncounter, projectEncounters, sentryWatchedHexes } from './encounter-state';
import { ENCOUNTER_RULES } from './encounter-content';
import type { HexEngineState } from '../commands/apply-command';
import {
  HERO,
  encounterDo,
  encounterWorld,
  eventTypes,
  idAt,
  rejection,
} from './encounter-test-setup';

const HERO_AT = { columnIndex: 3, rowIndex: 4 };
const ENC_AT = { columnIndex: 4, rowIndex: 4 };
const BEHIND = { columnIndex: 5, rowIndex: 4 };
const STRONG = { hearts: 3, power: 2, shield: 2 };

function packWorld(extra: Partial<Parameters<typeof encounterWorld>[0]> = {}) {
  return encounterWorld({
    encounters: [{ contentId: 'skeleton-pack', at: ENC_AT }],
    hero: HERO_AT,
    ...extra,
  });
}

const PACK = idAt('skeleton-pack', ENC_AT);

function heroAt(state: HexEngineState) {
  return state.heroes[HERO].coordinates;
}

function answerIndex(state: HexEngineState, id: string, correct: boolean): number {
  const sneak = findEncounter(state.map, id)!.encounter.sneak!;
  const index = sneak.options.indexOf(sneak.answer);
  return correct ? index : (index + 1) % 4;
}

describe('encounters on the dungeon map', () => {
  it('REQ-ENC-001: visible only from a revealed hex; count, leader, threat and sentry always; members after SCOUT', () => {
    const hidden = packWorld({ hidden: [ENC_AT] });
    expect(projectEncounters(hidden.map, STRONG)).toEqual([]);

    const state = packWorld();
    const [view] = projectEncounters(state.map, STRONG);
    expect(view).toMatchObject({
      id: PACK,
      count: 3,
      leaderKind: 'skeleton-warrior',
      sentry: false,
      scouted: false,
      members: ['skeleton-warrior', null, null],
    });
    expect(['easy', 'risky', 'deadly']).toContain(view.threat);

    encounterDo(state, { kind: 'scout', encounterId: PACK });
    expect(projectEncounters(state.map, STRONG)[0].members).toEqual([
      'skeleton-warrior',
      'skeleton-warrior',
      'skeleton-archer',
    ]);

    const lone = encounterWorld({
      encounters: [{ contentId: 'lone-skeleton', at: ENC_AT }],
      hero: HERO_AT,
    });
    expect(projectEncounters(lone.map, STRONG)[0]).toMatchObject({
      scouted: true,
      members: ['skeleton-warrior'],
    });
  });

  it('REQ-ENC-002: ATTACK and SCOUT only from an adjacent hex, priced from general Will; SCOUT twice is refused', () => {
    const far = packWorld({ hero: { columnIndex: 1, rowIndex: 4 } });
    expect(rejection(encounterDo(far, { kind: 'attack', encounterId: PACK }))).toBe('NOT_ADJACENT');
    expect(rejection(encounterDo(far, { kind: 'scout', encounterId: PACK }))).toBe('NOT_ADJACENT');
    expect(far.knowledge!.current).toBe(20);

    const state = packWorld();
    expect(eventTypes(encounterDo(state, { kind: 'scout', encounterId: PACK }))).toEqual([
      'WILL_SPENT',
      'ENCOUNTER_SCOUTED',
    ]);
    expect(state.knowledge!.current).toBe(20 - ENCOUNTER_RULES.scoutWill);
    expect(rejection(encounterDo(state, { kind: 'scout', encounterId: PACK }))).toBe(
      'ALREADY_SCOUTED',
    );

    const attacked = encounterDo(state, { kind: 'attack', encounterId: PACK });
    expect(eventTypes(attacked)).toEqual(['WILL_SPENT', 'BATTLE_REQUESTED']);
    expect(attacked[1].payload).toMatchObject({ encounterId: PACK, ambush: false });
    expect(state.knowledge!.current).toBe(
      20 - ENCOUNTER_RULES.scoutWill - ENCOUNTER_RULES.attackWill,
    );
    expect(state.engagement).toMatchObject({ encounterId: PACK, ambush: false, heroIds: [HERO] });

    const poor = packWorld({ will: 1 });
    expect(rejection(encounterDo(poor, { kind: 'attack', encounterId: PACK }))).toBe(
      'INSUFFICIENT_WILL',
    );
    expect(poor.knowledge!.current).toBe(1);
    expect(poor.engagement).toBeUndefined();
  });
});

describe('encounter sneak and sentry', () => {
  it('REQ-ENC-003: SNEAK — right answer puts the hero behind the group when free, else in place; wrong or late is an ambush', () => {
    const state = packWorld();
    encounterDo(state, { kind: 'start-sneak', encounterId: PACK }, 1000);
    const right = answerIndex(state, PACK, true);
    const won = encounterDo(
      state,
      { kind: 'answer-sneak', encounterId: PACK, option: right },
      2000,
    );
    expect(eventTypes(won)).toEqual(['SNEAK_SUCCEEDED']);
    expect(heroAt(state)).toEqual(BEHIND);
    expect(state.knowledge!.current).toBe(20);

    const blocked = packWorld({ walls: [BEHIND] });
    encounterDo(blocked, { kind: 'start-sneak', encounterId: PACK }, 1000);
    const stay = encounterDo(
      blocked,
      { kind: 'answer-sneak', encounterId: PACK, option: answerIndex(blocked, PACK, true) },
      2000,
    );
    expect(stay[0].payload).toMatchObject({ to: null });
    expect(heroAt(blocked)).toEqual(HERO_AT);

    const wrong = packWorld();
    encounterDo(wrong, { kind: 'start-sneak', encounterId: PACK }, 1000);
    const missed = encounterDo(
      wrong,
      { kind: 'answer-sneak', encounterId: PACK, option: answerIndex(wrong, PACK, false) },
      2000,
    );
    expect(eventTypes(missed)).toEqual(['AMBUSH', 'BATTLE_REQUESTED']);
    expect(wrong.engagement?.ambush).toBe(true);

    const late = packWorld();
    encounterDo(late, { kind: 'start-sneak', encounterId: PACK }, 1000);
    const slow = encounterDo(
      late,
      { kind: 'answer-sneak', encounterId: PACK, option: answerIndex(late, PACK, true) },
      1000 + ENCOUNTER_RULES.sneakMs + 1,
    );
    expect(eventTypes(slow)).toEqual(['AMBUSH', 'BATTLE_REQUESTED']);

    const timeout = packWorld();
    encounterDo(timeout, { kind: 'start-sneak', encounterId: PACK }, 1000);
    expect(eventTypes(encounterDo(timeout, { kind: 'sneak-timeout', encounterId: PACK }))).toEqual([
      'AMBUSH',
      'BATTLE_REQUESTED',
    ]);
  });

  it('REQ-ENC-004: ending a step next to a sentry is an ambush; next to a non-sentry nothing happens', () => {
    const sentryId = idAt('archer-watch', ENC_AT);
    const sentry = encounterWorld({
      encounters: [{ contentId: 'archer-watch', at: ENC_AT }],
      hero: { columnIndex: 1, rowIndex: 4 },
    });
    expect(sentryWatchedHexes(sentry.map)).toHaveLength(6);
    expect(encounterDo(sentry, { kind: 'step-ended' })).toEqual([]);
    sentry.heroes[HERO].coordinates = { ...HERO_AT };
    const seen = encounterDo(sentry, { kind: 'step-ended' });
    expect(eventTypes(seen)).toEqual(['AMBUSH', 'BATTLE_REQUESTED']);
    expect(seen[0].payload).toEqual({ encounterId: sentryId });

    const calm = packWorld();
    expect(encounterDo(calm, { kind: 'step-ended' })).toEqual([]);
    expect(calm.engagement).toBeUndefined();
  });
});
