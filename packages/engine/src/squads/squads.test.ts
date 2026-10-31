import { describe, expect, it } from 'vitest';
import { EHexActionType } from '../enums/hex-action-type';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { getMeta } from '../content/content-accessors';
import { resolveActions } from '../game-resolvers/interactions-resolver';
import type { HexEngineState } from '../commands/apply-command';
import { findSquad, projectSquads, watchedHexes } from './squad-state';
import { heroBattleCreature } from './squad-battle';
import {
  HERO,
  eventTypes,
  hexAction,
  idAt,
  moveHero,
  rejection,
  squadWorld,
} from './squad-test-setup';

const HERO_AT = { columnIndex: 3, rowIndex: 4 };
const SQUAD_AT = { columnIndex: 4, rowIndex: 4 };
const STRONG = { hearts: 3, power: 2, shield: 2 };
const PACK = idAt(HEXOBJECT_KEYS.SKELETON_PACK, SQUAD_AT);
const { ATTACK, SCOUT } = EHexActionType;

function packWorld(extra: Partial<Parameters<typeof squadWorld>[0]> = {}) {
  return squadWorld({
    squads: [{ key: HEXOBJECT_KEYS.SKELETON_PACK, at: SQUAD_AT }],
    hero: HERO_AT,
    ...extra,
  });
}

function willCost(actionType: EHexActionType): number {
  return getMeta(HEXOBJECT_KEYS.SKELETON_PACK).actions?.[actionType]?.willCost ?? 0;
}

function heroAt(state: HexEngineState) {
  return state.heroes[HERO].coordinates;
}

function actionsOf(state: HexEngineState, tool: 'hand' | 'sword') {
  const obj = findSquad(state.map, PACK)!.squad;
  return resolveActions(tool, obj).map((a) => a.actioType);
}

describe('squads as creature tokens', () => {
  it('REQ-ENC-001: visible only from a revealed hex; count, leader, threat and watcher always; members after SCOUT', () => {
    expect(projectSquads(packWorld({ hidden: [SQUAD_AT] }).map, STRONG)).toEqual([]);

    const state = packWorld();
    const [view] = projectSquads(state.map, STRONG);
    expect(view).toMatchObject({
      id: PACK,
      hexobjectKey: HEXOBJECT_KEYS.SKELETON_PACK,
      count: 2,
      leaderKind: 'skeleton-warrior',
      watcher: false,
      scouted: false,
      members: ['skeleton-warrior', null],
    });
    expect(['easy', 'risky', 'deadly']).toContain(view.threat);

    hexAction(state, SCOUT, SQUAD_AT);
    expect(projectSquads(state.map, STRONG)[0].members).toEqual([
      'skeleton-warrior',
      'skeleton-warrior',
    ]);

    const lone = squadWorld({
      squads: [{ key: HEXOBJECT_KEYS.LONE_SKELETON, at: SQUAD_AT }],
      hero: HERO_AT,
    });
    expect(projectSquads(lone.map, STRONG)[0]).toMatchObject({
      scouted: true,
      members: ['skeleton-warrior'],
    });
  });

  it('the hand offers ATTACK and SCOUT, the sword only ATTACK; SCOUT disappears once scouted', () => {
    const state = packWorld();
    expect(actionsOf(state, 'hand')).toEqual(['ATTACK', 'SCOUT']);
    expect(actionsOf(state, 'sword')).toEqual(['ATTACK']);
    hexAction(state, SCOUT, SQUAD_AT);
    expect(actionsOf(state, 'hand')).toEqual(['ATTACK']);
  });

  it('REQ-ENC-002: ATTACK and SCOUT only from an adjacent hex, priced from the content Will cost; SCOUT twice is refused', () => {
    const far = packWorld({ hero: { columnIndex: 1, rowIndex: 4 } });
    expect(rejection(hexAction(far, ATTACK, SQUAD_AT))).toBe('NOT_ADJACENT');
    expect(rejection(hexAction(far, SCOUT, SQUAD_AT))).toBe('NOT_ADJACENT');
    expect(far.knowledge!.current).toBe(20);

    const state = packWorld();
    expect(eventTypes(hexAction(state, SCOUT, SQUAD_AT))).toEqual([
      'WILL_SPENT',
      'SQUAD_SCOUTED',
      'HEX_ACTION_STARTED',
    ]);
    expect(state.knowledge!.current).toBe(20 - willCost(SCOUT));
    const twice = hexAction(state, SCOUT, SQUAD_AT);
    expect(rejection(twice)).toBe('ALREADY_SCOUTED');
    expect(eventTypes(twice)).toContain('HEX_ACTION_START_REJECTED');
    expect(state.knowledge!.current).toBe(20 - willCost(SCOUT));

    const attacked = hexAction(state, ATTACK, SQUAD_AT);
    expect(eventTypes(attacked)).toEqual(['WILL_SPENT', 'BATTLE_REQUESTED', 'HEX_ACTION_STARTED']);
    expect(attacked[1].payload).toMatchObject({ squadId: PACK, ambush: false });
    expect(state.knowledge!.current).toBe(20 - willCost(SCOUT) - willCost(ATTACK));
    expect(state.engagement).toMatchObject({ squadId: PACK, ambush: false, heroIds: [HERO] });
    expect(rejection(hexAction(state, ATTACK, SQUAD_AT))).toBe('BATTLE_OPEN');

    const poor = packWorld({ will: 1 });
    expect(rejection(hexAction(poor, ATTACK, SQUAD_AT))).toBe('INSUFFICIENT_WILL');
    expect(poor.knowledge!.current).toBe(1);
    expect(poor.engagement).toBeUndefined();
  });

  it('a squad token blocks movement like any solid object', () => {
    const state = packWorld({ hero: { columnIndex: 2, rowIndex: 4 } });
    expect(eventTypes(moveHero(state, SQUAD_AT))).toEqual(['HERO_MOVE_REJECTED']);
  });
});

describe('squad watcher', () => {
  it('REQ-ENC-004: a move into a watched hex stops there and is an ambush; next to a non-watcher nothing happens', () => {
    const watchAt = idAt(HEXOBJECT_KEYS.ARCHER_WATCH, SQUAD_AT);
    const watched = squadWorld({
      squads: [{ key: HEXOBJECT_KEYS.ARCHER_WATCH, at: SQUAD_AT }],
      hero: { columnIndex: 1, rowIndex: 4 },
    });
    expect(watchedHexes(watched.map)).toHaveLength(6);
    watched.heroes[HERO].heroSteps = 200;
    const seen = moveHero(watched, { columnIndex: 3, rowIndex: 5 });
    expect(eventTypes(seen)).toEqual(['HERO_MOVED', 'AMBUSH', 'BATTLE_REQUESTED']);
    expect(seen[1].payload).toEqual({ squadId: watchAt });
    const stoppedAt = heroAt(watched);
    expect(watchedHexes(watched.map)).toContainEqual(stoppedAt);
    const path = (seen[0].payload as { path: unknown[] }).path;
    expect(path[path.length - 1]).toEqual(stoppedAt);
    expect(watched.engagement).toMatchObject({ squadId: watchAt, ambush: true });

    const calm = packWorld({ hero: { columnIndex: 1, rowIndex: 4 } });
    calm.heroes[HERO].heroSteps = 200;
    expect(eventTypes(moveHero(calm, HERO_AT))).toEqual(['HERO_MOVED']);
    expect(calm.engagement).toBeUndefined();
  });
});

describe('heroBattleCreature hearts', () => {
  it('keeps the hero maximum from the hero board, not his current hearts', () => {
    const hero = heroBattleCreature({
      id: 'hero',
      hearts: 2,
      maxHearts: 4,
      weapon: null,
      shield: null,
      bag: [],
    });
    expect([hero.hp, hero.maxHp]).toEqual([4, 8]);
  });
});
