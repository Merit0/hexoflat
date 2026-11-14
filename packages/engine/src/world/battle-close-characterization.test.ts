import { describe, expect, it } from 'vitest';
import { emptyProgressState } from '../aggregates/progress-state';
import { creatureById } from '../battle/battle-board';
import { applyBattleFixture } from '../battle/battle-fixtures';
import type { BattleState } from '../battle/battle-state';
import {
  battleWith,
  enemyTurn,
  eventTypes,
  giveTurn,
  hero,
  heroDoes,
  rejectionOf,
  skeleton,
} from '../battle/battle-test-setup';
import { BATTLE_RULES } from '../battle/battle-content';
import { projectBattleForViewer } from '../battle/projection';
import { EHexActionType } from '../enums/hex-action-type';
import { emptyInventoryState, mintItem, type InventoryState } from '../inventory/inventory-state';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { findSquad } from '../squads/squad-state';
import { HERO, hexAction, idAt, squadWorld } from '../squads/squad-test-setup';
import {
  battleWorld,
  createServerWorld,
  deserializeWorld,
  serializeWorld,
  type BattleWorldOutcome,
  type ServerWorld,
  type TravelRun,
} from './index';

const OFF = { ...BATTLE_RULES, graveLootEnabled: false };
const HERO_AT = { columnIndex: 3, rowIndex: 4 };
const SQUAD_AT = { columnIndex: 4, rowIndex: 4 };
const PACK = idAt(HEXOBJECT_KEYS.SKELETON_PACK, SQUAD_AT);

function inventory(): InventoryState {
  const inv = emptyInventoryState(HERO);
  inv.equip.weapon = mintItem(inv, HEXOBJECT_KEYS.SWORD, 1);
  inv.equip.shield = mintItem(inv, HEXOBJECT_KEYS.SHIELD, 1);
  return inv;
}

function engaged(): TravelRun {
  const state = squadWorld({
    squads: [{ key: HEXOBJECT_KEYS.SKELETON_PACK, at: SQUAD_AT }],
    hero: HERO_AT,
  });
  hexAction(state, EHexActionType.ATTACK, SQUAD_AT);
  const world: ServerWorld = {
    locationKey: 'cave',
    mapId: 'map-1',
    map: state.map,
    descriptor: null,
    heroCoordinates: { ...HERO_AT },
    worldSeed: 'seed-1',
    engagement: state.engagement ?? null,
    battle: null,
  };
  const camp = createServerWorld('camping', 'fresh-camp', 'expedition', HERO);
  return {
    world,
    progress: emptyProgressState(HERO),
    inventory: inventory(),
    heroId: HERO,
    now: 10_000,
    loadStored: (key) => (key === 'camping' ? camp : null),
    loadById: () => null,
    create: (key) => createServerWorld(key, `fresh-${key}`, 'expedition', HERO),
  };
}

function ok(outcome: BattleWorldOutcome) {
  if (!outcome.ok) throw new Error(`refused: ${outcome.code}`);
  return outcome;
}

function startedRun(): TravelRun {
  const run = engaged();
  const started = ok(battleWorld(run, { kind: 'start', heroId: HERO }, OFF));
  return { ...run, world: started.world, progress: started.progress, inventory: started.inventory };
}

function ended(run: TravelRun, outcome: 'victory' | 'defeat'): TravelRun {
  const world = {
    ...run.world,
    battle: applyBattleFixture(run.world.battle!, { kind: 'finish', outcome }),
  };
  return { ...run, world };
}

function duel(): BattleState {
  const state = battleWith([hero({ q: 0, r: 0 }), skeleton('s1', { q: 1, r: 0 })]);
  delete state.lootEnabled;
  delete state.fallen;
  return giveTurn(state, ['hero', 's1']);
}

describe('REQ-LOOT-071 characterization: a won battle without grave loot', () => {
  it('ends at once, leaves no grave data and refuses every later action with BATTLE_ENDED', () => {
    const start = duel();
    start.creatures[1].hp = 2;
    const struck = heroDoes(start, { kind: 'strike', targetId: 's1', hand: 'right' });
    expect(struck.battle.phase).toBe('ended');
    expect(struck.battle.outcome).toBe('victory');
    expect(eventTypes(struck.events)).toContain('BATTLE_ENDED');
    expect(struck.battle).not.toHaveProperty('collect');
    expect(struck.battle).not.toHaveProperty('lootEnabled');
    expect(struck.battle).not.toHaveProperty('fallen');
    for (const action of [
      { kind: 'move', hex: { q: 0, r: 1 } },
      { kind: 'end-turn' },
      { kind: 'undo-step' },
    ] as const) {
      expect(rejectionOf(heroDoes(struck.battle, action).events)).toBe('BATTLE_ENDED');
    }
    expect(rejectionOf(enemyTurn(struck.battle).events)).toBe('BATTLE_ENDED');
  });

  it('keeps the dead creature in the list with zero hearts and treats its hex as free', () => {
    const start = duel();
    start.creatures[1].hp = 2;
    const { battle } = heroDoes(start, { kind: 'strike', targetId: 's1', hand: 'right' });
    expect(creatureById(battle, 's1')!.hp).toBe(0);
    expect(creatureById(battle, 's1')!.pos).toEqual({ q: 1, r: 0 });
  });
});

describe('REQ-LOOT-072 characterization: a lost battle', () => {
  it('ends with a defeat and never opens a collection phase', () => {
    const start = giveTurn(
      battleWith([hero({ q: 0, r: 0 }, { hp: 1 }), skeleton('s1', { q: 1, r: 0 })]),
      ['s1', 'hero'],
    );
    const enemy = enemyTurn(start);
    const done = heroDoes(enemy.battle, { kind: 'take-hit' });
    expect(done.battle.outcome).toBe('defeat');
    expect(done.battle.phase).toBe('ended');
    expect(done.battle).not.toHaveProperty('collect');
    expect(rejectionOf(heroDoes(done.battle, { kind: 'move', hex: { q: 0, r: 1 } }).events)).toBe(
      'BATTLE_ENDED',
    );
  });
});

describe('REQ-LOOT-073 characterization: WORLD_BATTLE close after a victory', () => {
  it('removes the squad token, frees its hex, counts the kills and clears the battle', () => {
    const run = ended(startedRun(), 'victory');
    expect(findSquad(run.world.map, PACK)).not.toBeNull();
    const closed = ok(battleWorld({ ...run, now: 20_000 }, { kind: 'close', heroId: HERO }, OFF));
    expect(closed.world.battle).toBeNull();
    expect(closed.world.engagement).toBeNull();
    expect(findSquad(closed.world.map, PACK)).toBeNull();
    const tile = closed.world.map.tiles.find(
      (t) => t.coordinates.columnIndex === 4 && t.coordinates.rowIndex === 4,
    )!;
    expect(tile.hexobject).toBeNull();
    const types = closed.events.map((event) => event.type);
    expect(types).toContain('SQUAD_DEFEATED');
    expect(types).toContain('BATTLE_CLOSED');
    const payload = closed.events.find((event) => event.type === 'BATTLE_CLOSED')!.payload as {
      outcome: string;
      kills: number;
    };
    expect(payload.outcome).toBe('victory');
    expect(payload.kills).toBe(2);
    expect(closed.progress.kills).toBe(2);
    expect(closed.respawn).toBeNull();
    expect(closed.steps.at(-1)!.battle).toBeNull();
  });

  it('is accepted whatever hex the hero stands on and refuses a battle that has not ended', () => {
    const run = startedRun();
    const early = battleWorld({ ...run, now: 20_000 }, { kind: 'close', heroId: HERO }, OFF);
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.code).toBe('BATTLE_NOT_ENDED');
    const won = ended(run, 'victory');
    const hero = won.world.battle!.creatures.find((c) => c.side === 'heroes')!;
    hero.pos = { q: hero.pos.q + 1, r: hero.pos.r };
    expect(battleWorld({ ...won, now: 20_000 }, { kind: 'close', heroId: HERO }, OFF).ok).toBe(
      true,
    );
  });
});

describe('REQ-LOOT-074 characterization: WORLD_BATTLE close after a defeat', () => {
  it('sends the hero to the camp with a fresh dungeon and keeps the squad token', () => {
    const run = ended(startedRun(), 'defeat');
    const closed = ok(battleWorld({ ...run, now: 20_000 }, { kind: 'close', heroId: HERO }, OFF));
    expect(closed.respawn).not.toBeNull();
    expect(closed.respawn!.destination.locationKey).toBe('camping');
    expect(closed.progress.kills).toBe(0);
    expect(closed.events.map((event) => event.type)).toContain('HERO_RESPAWNED');
  });
});

describe('REQ-LOOT-075 characterization: restoring a battle session', () => {
  it('projects an ended victory with the same public keys and no secrets', () => {
    const run = ended(startedRun(), 'victory');
    const view = projectBattleForViewer(run.world.battle!, 'heroes');
    expect(view.phase).toBe('ended');
    expect(view.outcome).toBe('victory');
    expect(Object.keys(view).sort()).toEqual([
      'activeId',
      'advantage',
      'board',
      'boulders',
      'creatures',
      'draws',
      'id',
      'order',
      'outcome',
      'pending',
      'phase',
      'placedShields',
      'reaction',
      'round',
      'shieldsRaised',
      'stance',
      'strikeSeq',
      'struckHands',
      'taskSeq',
      'turnIndex',
      'turnWill',
      'undo',
      'viewer',
    ]);
    const text = JSON.stringify(view);
    expect(text).not.toContain(run.world.battle!.seed);
  });

  it('survives a save and load of the world with the battle unchanged', () => {
    const run = ended(startedRun(), 'victory');
    const restored = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(run.world))), 0);
    expect(restored.battle).toEqual(run.world.battle);
    expect(restored.engagement).toEqual(run.world.engagement);
  });
});
