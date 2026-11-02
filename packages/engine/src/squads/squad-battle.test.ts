import { describe, expect, it } from 'vitest';
import { EHexActionType } from '../enums/hex-action-type';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { isEnterableTile } from '../hero-movement/move-planner';
import type { HexEngineState } from '../commands/apply-command';
import HexMapModel, { type ISerializedHexMap } from '../map/models/hex-map-model';
import { squadThreat, handsProfile, THREAT_RULES, type Threat } from '../battle/threat';
import { CONTENT } from '../content/content-map';
import { engagementSchema } from './engagement';
import { findSquad, projectSquads } from './squad-state';
import { heroBattleCreature } from './squad-battle';
import {
  HERO,
  eventTypes,
  hexAction,
  idAt,
  lifecycle,
  rejection,
  squadWorld,
} from './squad-test-setup';

const HERO_AT = { columnIndex: 3, rowIndex: 4 };
const SQUAD_AT = { columnIndex: 4, rowIndex: 4 };
const STRONG = { hearts: 3, power: 2, shield: 2 };
const PACK = idAt(HEXOBJECT_KEYS.SKELETON_PACK, SQUAD_AT);

function packWorld() {
  return squadWorld({
    squads: [{ key: HEXOBJECT_KEYS.SKELETON_PACK, at: SQUAD_AT }],
    hero: HERO_AT,
  });
}

function heroAt(state: HexEngineState) {
  return state.heroes[HERO].coordinates;
}

function tileAt(map: HexMapModel, at: typeof SQUAD_AT) {
  return map.tiles.find(
    (t) => t.coordinates.columnIndex === at.columnIndex && t.coordinates.rowIndex === at.rowIndex,
  )!;
}

const SQUAD_MEMBERS = Object.values(CONTENT).flatMap((def) =>
  def.groupType === EHexobjectGroup.CREATURE && def.creature.squad
    ? [def.creature.squad.members]
    : [],
);

describe('squad battles, loot, threat and saves', () => {
  it('REQ-ENC-007: victory puts the hero back on the start hex and the squad hex disappears without a loot token', () => {
    const state = packWorld();
    hexAction(state, EHexActionType.ATTACK, SQUAD_AT);
    const hero = heroBattleCreature({
      id: HERO,
      hearts: 3,
      weapon: 'sword',
      shield: 'shield',
      bag: ['health-bottle'],
    });
    expect(eventTypes(lifecycle(state, { kind: 'start', heroes: [hero] }))).toContain(
      'BATTLE_STARTED',
    );
    expect(rejection(lifecycle(state, { kind: 'close' }))).toBe('BATTLE_NOT_ENDED');

    const battle = state.battle!;
    for (const c of battle.creatures) if (c.side === 'enemies') c.hp = 0;
    const me = battle.creatures.find((c) => c.id === HERO)!;
    me.hp = 3;
    me.bag = [];
    battle.outcome = 'victory';
    battle.phase = 'ended';

    const closed = lifecycle(state, { kind: 'close' });
    expect(eventTypes(closed)).toEqual(['SQUAD_DEFEATED', 'BATTLE_CLOSED']);
    expect(closed[1].payload).toMatchObject({
      outcome: 'victory',
      heroAt: HERO_AT,
      kills: 2,
      heroes: [{ id: HERO, hearts: 1.5, consumed: ['health-bottle'] }],
    });
    expect(state.battle).toBeUndefined();
    expect(state.engagement).toBeUndefined();
    expect(heroAt(state)).toEqual(HERO_AT);
    expect(projectSquads(state.map, STRONG)).toEqual([]);
    expect(tileAt(state.map, SQUAD_AT).hexobject).toBeNull();
  });

  it('REQ-ENC-007: defeat keeps the squad and counts the attempt for the next battlefield seed', () => {
    const state = packWorld();
    hexAction(state, EHexActionType.ATTACK, SQUAD_AT);
    const hero = heroBattleCreature({
      id: HERO,
      hearts: 3,
      weapon: 'sword',
      shield: null,
      bag: [],
    });
    lifecycle(state, { kind: 'start', heroes: [hero] });
    const firstSeed = state.battle!.seed;
    state.battle!.outcome = 'defeat';
    state.battle!.phase = 'ended';
    expect(eventTypes(lifecycle(state, { kind: 'close' }))).toEqual(['BATTLE_CLOSED']);
    expect(findSquad(state.map, PACK)!.squad.creature.attempts).toBe(1);
    expect(isEnterableTile(state.map, SQUAD_AT)).toBe(false);

    hexAction(state, EHexActionType.ATTACK, SQUAD_AT);
    lifecycle(state, { kind: 'start', heroes: [hero] });
    expect(state.battle!.seed).not.toBe(firstSeed);
  });

  it('REQ-ENC-008: squadThreat is monotone — a stronger hero never raises the threat', () => {
    const rank: Record<Threat, number> = { easy: 0, risky: 1, deadly: 2 };
    const profiles = Array.from({ length: 12 }, (_, h) => (h + 1) / 2).flatMap((hearts) =>
      [1, 2, 3, 4].flatMap((power) => [0, 1, 2, 3, 4].map((shield) => ({ hearts, power, shield }))),
    );
    expect(SQUAD_MEMBERS.length).toBeGreaterThan(0);
    for (const members of SQUAD_MEMBERS) {
      for (const { hearts, power, shield } of profiles) {
        const base = rank[squadThreat(members, { hearts, power, shield })];
        const stronger = [
          { hearts: hearts + 0.5, power, shield },
          { hearts, power: power + 1, shield },
          { hearts, power, shield: shield + 1 },
        ];
        for (const hero of stronger) {
          expect(rank[squadThreat(members, hero)]).toBeLessThanOrEqual(base);
        }
      }
    }
    expect(handsProfile(3, { right: null, left: null }).power).toBe(THREAT_RULES.unarmedPower);
  });

  it('keeps the squad instance state in the saved map', () => {
    const state = packWorld();
    hexAction(state, EHexActionType.SCOUT, SQUAD_AT);
    findSquad(state.map, PACK)!.squad.creature.attempts = 2;
    const saved = JSON.parse(JSON.stringify(state.map.toJSON())) as ISerializedHexMap;
    const loaded = HexMapModel.fromJSON(saved, 0);
    expect(findSquad(loaded, PACK)?.squad.creature).toMatchObject({ scouted: true, attempts: 2 });
  });
});

describe('B6b save migration (D1, no CONTENT_VERSION bump)', () => {
  function savedWith(edit: (tile: ISerializedHexMap['tiles'][number]) => void): ISerializedHexMap {
    const state = squadWorld({ squads: [], hero: HERO_AT });
    const saved = JSON.parse(JSON.stringify(state.map.toJSON())) as ISerializedHexMap;
    const tile = saved.tiles.find(
      (t) => t.coordinates?.columnIndex === 6 && t.coordinates.rowIndex === 6,
    )!;
    edit(tile);
    return saved;
  }
  const AT = { columnIndex: 6, rowIndex: 6 };

  it('an active tile.encounter becomes the squad token with its instance state', () => {
    const saved = savedWith((t) => {
      t.encounter = {
        id: 'skeleton-pack@6-6',
        contentId: 'skeleton-pack',
        scouted: true,
        status: 'active',
        attempts: 1,
      };
    });
    const loaded = HexMapModel.fromJSON(saved, 0);
    const squad = findSquad(loaded, idAt(HEXOBJECT_KEYS.SKELETON_PACK, AT))!.squad;
    expect(squad.creature).toMatchObject({ scouted: true, attempts: 1 });
    expect(JSON.stringify(loaded.toJSON())).not.toContain('"encounter"');
  });

  it('a legacy loot or looted encounter leaves the hex empty', () => {
    const loot = HexMapModel.fromJSON(
      savedWith((t) => {
        t.encounter = { id: 'x', contentId: 'skeleton-pack', status: 'loot' };
      }),
      0,
    );
    expect(tileAt(loot, AT).hexobject).toBeNull();

    const looted = HexMapModel.fromJSON(
      savedWith((t) => {
        t.encounter = { id: 'x', contentId: 'skeleton-pack', status: 'looted' };
      }),
      0,
    );
    expect(tileAt(looted, AT).hexobject).toBeNull();
  });

  it('a legacy skeletor hexobject becomes a lone-skeleton squad', () => {
    const loaded = HexMapModel.fromJSON(
      savedWith((t) => {
        t.hexobject = { hexobjectKey: 'skeletor', groupType: 'CREATURE' } as never;
      }),
      0,
    );
    expect(findSquad(loaded, idAt(HEXOBJECT_KEYS.LONE_SKELETON, AT))).not.toBeNull();
  });

  it('an old engagement with encounterId parses to the squad id', () => {
    const parsed = engagementSchema.parse({
      encounterId: 'bone-court@6-6',
      ambush: false,
      heroAt: { columnIndex: 5, rowIndex: 6 },
      heroIds: [HERO],
    });
    expect(parsed.squadId).toBe(idAt(HEXOBJECT_KEYS.BONE_COURT, AT));
  });
});
