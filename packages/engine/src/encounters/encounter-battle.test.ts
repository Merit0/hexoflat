import { describe, expect, it } from 'vitest';
import { findEncounter, projectEncounters } from './encounter-state';
import { encounterThreat, handsProfile, type Threat } from './threat';
import { ENCOUNTER_RULES, ENCOUNTERS } from './encounter-content';
import { heroBattleCreature } from './encounter-battle';
import { isEnterableTile } from '../hero-movement/move-planner';
import type { HexEngineState } from '../commands/apply-command';
import HexMapModel, { type ISerializedHexMap } from '../map/models/hex-map-model';
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

describe('encounter battles, loot, threat and saves', () => {
  it('REQ-ENC-007: victory puts the hero back on the start hex and turns the group into loot; PICKUP_LOOT gives the items', () => {
    const state = packWorld();
    encounterDo(state, { kind: 'attack', encounterId: PACK });
    const hero = heroBattleCreature({
      id: HERO,
      hearts: 3,
      weapon: 'sword',
      shield: 'shield',
      bag: ['health-bottle'],
    });
    expect(eventTypes(encounterDo(state, { kind: 'start-battle', heroes: [hero] }))).toContain(
      'BATTLE_STARTED',
    );
    expect(rejection(encounterDo(state, { kind: 'close-battle' }))).toBe('BATTLE_NOT_ENDED');

    const battle = state.battle!;
    for (const c of battle.creatures) if (c.side === 'enemies') c.hp = 0;
    const me = battle.creatures.find((c) => c.id === HERO)!;
    me.hp = 3;
    me.bag = [];
    battle.outcome = 'victory';
    battle.phase = 'ended';

    const closed = encounterDo(state, { kind: 'close-battle' });
    expect(eventTypes(closed)).toEqual(['ENCOUNTER_DEFEATED', 'LOOT_DROPPED', 'BATTLE_CLOSED']);
    expect(closed[2].payload).toMatchObject({
      outcome: 'victory',
      heroAt: HERO_AT,
      kills: 3,
      heroes: [{ id: HERO, hearts: 1.5, consumed: ['health-bottle'] }],
    });
    expect(state.battle).toBeUndefined();
    expect(state.engagement).toBeUndefined();
    expect(heroAt(state)).toEqual(HERO_AT);
    expect(projectEncounters(state.map, STRONG)[0]).toMatchObject({
      status: 'loot',
      loot: ENCOUNTERS['skeleton-pack'].loot,
    });
    expect(isEnterableTile(state.map, ENC_AT)).toBe(false);

    const picked = encounterDo(state, { kind: 'pickup-loot', encounterId: PACK });
    expect(eventTypes(picked)).toEqual(['LOOT_PICKED']);
    expect(picked[0].payload).toMatchObject({ items: ENCOUNTERS['skeleton-pack'].loot });
    expect(projectEncounters(state.map, STRONG)).toEqual([]);
    expect(isEnterableTile(state.map, ENC_AT)).toBe(true);
    expect(rejection(encounterDo(state, { kind: 'pickup-loot', encounterId: PACK }))).toBe(
      'NO_LOOT',
    );
  });

  it('REQ-ENC-007: defeat keeps the group and counts the attempt for the next battlefield seed', () => {
    const state = packWorld();
    encounterDo(state, { kind: 'attack', encounterId: PACK });
    const hero = heroBattleCreature({
      id: HERO,
      hearts: 3,
      weapon: 'sword',
      shield: null,
      bag: [],
    });
    encounterDo(state, { kind: 'start-battle', heroes: [hero] });
    const firstSeed = state.battle!.seed;
    state.battle!.outcome = 'defeat';
    state.battle!.phase = 'ended';
    const closed = encounterDo(state, { kind: 'close-battle' });
    expect(closed.map((e) => e.type)).toEqual(['BATTLE_CLOSED']);
    const placed = findEncounter(state.map, PACK)!;
    expect(placed.encounter).toMatchObject({ status: 'active', attempts: 1 });

    encounterDo(state, { kind: 'attack', encounterId: PACK });
    encounterDo(state, { kind: 'start-battle', heroes: [hero] });
    expect(state.battle!.seed).not.toBe(firstSeed);
  });

  it('REQ-ENC-008: encounterThreat is monotone — a stronger hero never raises the threat', () => {
    const rank: Record<Threat, number> = { easy: 0, risky: 1, deadly: 2 };
    const profiles = Array.from({ length: 12 }, (_, h) => (h + 1) / 2).flatMap((hearts) =>
      [1, 2, 3, 4].flatMap((power) => [0, 1, 2, 3, 4].map((shield) => ({ hearts, power, shield }))),
    );
    for (const def of Object.values(ENCOUNTERS)) {
      for (const { hearts, power, shield } of profiles) {
        const base = rank[encounterThreat(def.members, { hearts, power, shield })];
        const stronger = [
          { hearts: hearts + 0.5, power, shield },
          { hearts, power: power + 1, shield },
          { hearts, power, shield: shield + 1 },
        ];
        for (const hero of stronger) {
          expect(rank[encounterThreat(def.members, hero)]).toBeLessThanOrEqual(base);
        }
      }
    }
    expect(handsProfile(3, { right: null, left: null }).power).toBe(ENCOUNTER_RULES.unarmedPower);
  });

  it('keeps the encounter state in the saved map and loads old maps without encounters', () => {
    const state = packWorld();
    encounterDo(state, { kind: 'scout', encounterId: PACK });
    const saved = JSON.parse(JSON.stringify(state.map.toJSON())) as ISerializedHexMap;
    const loaded = HexMapModel.fromJSON(saved, 0);
    expect(findEncounter(loaded, PACK)?.encounter).toMatchObject({
      scouted: true,
      status: 'active',
    });

    for (const tile of saved.tiles) delete tile.encounter;
    expect(projectEncounters(HexMapModel.fromJSON(saved, 0), STRONG)).toEqual([]);
  });

  it('D1: a saved legacy skeletor becomes a lone-skeleton encounter on load', () => {
    const state = packWorld();
    const saved = JSON.parse(JSON.stringify(state.map.toJSON())) as ISerializedHexMap;
    const legacyAt = { columnIndex: 6, rowIndex: 6 };
    const tile = saved.tiles.find(
      (t) => t.coordinates?.columnIndex === 6 && t.coordinates.rowIndex === 6,
    )!;
    tile.hexobject = { hexobjectKey: 'skeletor' } as never;
    const loaded = HexMapModel.fromJSON(saved, 0);
    const migrated = findEncounter(loaded, idAt('lone-skeleton', legacyAt));
    expect(migrated?.tile.hexobject).toBeNull();
    expect(migrated?.encounter.status).toBe('active');
  });
});
