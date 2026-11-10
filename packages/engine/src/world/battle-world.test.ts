import { describe, expect, it } from 'vitest';
import { emptyProgressState } from '../aggregates/progress-state';
import { WORLD_COMMAND_SCHEMAS } from '../aggregates/world-player-commands';
import { BATTLE_RULES } from '../battle/battle-content';
import { creatureById } from '../battle/battle-board';
import type { BattleState } from '../battle/battle-state';
import { EHexActionType } from '../enums/hex-action-type';
import { emptyInventoryState, mintItem, type InventoryState } from '../inventory/inventory-state';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { findSquad } from '../squads/squad-state';
import { HERO, hexAction, idAt, squadWorld } from '../squads/squad-test-setup';
import {
  battleWorld,
  createServerWorld,
  diffTiles,
  projectDiffsForClient,
  projectTileForClient,
  projectWorldForClient,
  serializeWorld,
  snapshotTiles,
  stepWorld,
  type BattleWorldOutcome,
  type ServerWorld,
  type TravelRun,
  type WorldRun,
} from './index';

const HERO_AT = { columnIndex: 3, rowIndex: 4 };
const SQUAD_AT = { columnIndex: 4, rowIndex: 4 };
const PACK = idAt(HEXOBJECT_KEYS.SKELETON_PACK, SQUAD_AT);

function inventory(): InventoryState {
  const inv = emptyInventoryState(HERO);
  inv.equip.weapon = mintItem(inv, HEXOBJECT_KEYS.SWORD, 1);
  inv.equip.shield = mintItem(inv, HEXOBJECT_KEYS.SHIELD, 1);
  inv.bag[0] = mintItem(inv, HEXOBJECT_KEYS.HEALTH_BOTTLE, 1);
  return inv;
}

const camps = new Map<string, ServerWorld>();

function engaged(seed = 'seed-1'): TravelRun {
  camps.clear();
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
    worldSeed: seed,
    engagement: state.engagement ?? null,
    battle: null,
  };
  return {
    world,
    progress: emptyProgressState(HERO),
    inventory: inventory(),
    heroId: HERO,
    now: 10_000,
    loadStored: (key) => (key === 'camping' ? (camps.get('camping') ?? null) : null),
    loadById: () => null,
    create: (key) => {
      const created = createServerWorld(key, `fresh-${key}`, 'expedition', HERO);
      if (key === 'camping') camps.set('camping', created);
      return created;
    },
  };
}

type Payload = Parameters<typeof battleWorld>[1];

function ok(outcome: BattleWorldOutcome) {
  if (!outcome.ok) throw new Error(`refused: ${outcome.code}`);
  return outcome;
}

class Table {
  run: TravelRun;
  constructor(run: TravelRun) {
    this.run = run;
  }
  send(payload: Payload, at: number = this.run.now): BattleWorldOutcome {
    const outcome = battleWorld({ ...this.run, now: at }, payload);
    if (outcome.ok) {
      this.run = {
        ...this.run,
        world: outcome.world,
        progress: outcome.progress,
        inventory: outcome.inventory,
        now: at,
      };
    }
    return outcome;
  }
  hero(action: Extract<Payload, { kind: 'hero' }>['action'], at?: number) {
    return this.send({ kind: 'hero', heroId: HERO, action }, at);
  }
  get battle(): BattleState {
    return this.run.world.battle!;
  }
  get active() {
    return creatureById(this.battle, this.battle.activeId)!;
  }
  playUntil(side: 'heroes' | 'enemies', limit = 60): void {
    for (let i = 0; i < limit; i += 1) {
      const idle = !this.battle.reaction && this.battle.phase === 'act';
      if (this.battle.phase === 'ended' || (idle && this.active.side === side)) break;
      const at = this.run.now + 1000;
      if (this.battle.reaction && this.active.side === 'heroes')
        this.hero({ kind: 'take-hit' }, at);
      else if (this.active.side === 'heroes') this.hero({ kind: 'end-turn' }, at);
      else this.send({ kind: 'run-enemy-turn', heroId: HERO }, at);
    }
    expect(this.active.side).toBe(side);
  }
}

function started(seed?: string): Table {
  const table = new Table(engaged(seed));
  ok(table.send({ kind: 'start', heroId: HERO }));
  return table;
}

describe('REQ-SRV-BTL-001 a battle the server holds', () => {
  it('starts from the server state: hero health and hands come from progress and inventory', () => {
    const run = engaged();
    run.progress.health.current = 2;
    const table = new Table(run);
    const out = ok(table.send({ kind: 'start', heroId: HERO }));
    const hero = creatureById(table.battle, HERO)!;
    expect(hero.hp).toBe(4);
    expect(hero.hands.right?.key).toBe('sword');
    expect(hero.hands.left?.key).toBe('wooden-shield');
    expect(out.steps[0].battle?.viewer).toBe('heroes');
    expect(table.run.world.battle).not.toBeNull();
  });

  it('refuses a client that sends its own clock or its own hero', () => {
    const schema = WORLD_COMMAND_SCHEMAS.WORLD_BATTLE;
    const base = { type: 'WORLD_BATTLE', payload: { kind: 'start', heroId: HERO } };
    expect(schema.safeParse(base).success).toBe(true);
    expect(schema.safeParse({ ...base, payload: { ...base.payload, atMs: 1 } }).success).toBe(
      false,
    );
    expect(schema.safeParse({ ...base, payload: { ...base.payload, heroes: [] } }).success).toBe(
      false,
    );
  });

  it('keeps every secret out of the answer: seed, RNG, history, wounds, clocks', () => {
    const table = started();
    table.playUntil('enemies');
    const out = ok(table.send({ kind: 'run-enemy-turn', heroId: HERO }, table.run.now + 1000));
    const text = JSON.stringify(out.steps);
    expect(text).not.toContain(table.battle.seed);
    for (const key of ['"seed"', '"taskHistory"', '"wounds"', '"turnClockMs"']) {
      expect(text).not.toContain(key);
    }
  });

  it('refuses a hero action during an enemy turn and changes nothing', () => {
    const table = started();
    table.playUntil('enemies');
    const before = JSON.stringify(table.battle);
    const out = table.hero({ kind: 'end-turn' }, table.run.now + 10);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe('NOT_YOUR_TURN');
    expect(JSON.stringify(table.battle)).toBe(before);
  });

  it('writes the hero hearts to progress.health after every step', () => {
    const table = started();
    for (let i = 0; i < 12 && table.battle.phase !== 'ended'; i += 1) {
      const at = table.run.now + 1000;
      if (table.active.side === 'heroes') table.hero({ kind: 'end-turn' }, at);
      else table.send({ kind: 'run-enemy-turn', heroId: HERO }, at);
      expect(table.run.progress.health.current * 2).toBe(creatureById(table.battle, HERO)!.hp);
    }
  });

  it('refuses the world while the battle is open', () => {
    const table = started();
    const out = stepWorld(table.run, { columnIndex: 2, rowIndex: 4 });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe('BATTLE_OPEN');
  });
});

function windowOpened(table: Table): void {
  for (let i = 0; i < 80 && !table.battle.reaction; i += 1) {
    const at = table.run.now + 1000;
    if (table.battle.phase === 'ended') break;
    if (table.active.side === 'heroes') table.hero({ kind: 'end-turn' }, at);
    else table.send({ kind: 'run-enemy-turn', heroId: HERO }, at);
  }
}

describe('REQ-SRV-BTL-002 the clock is the server clock', () => {
  it('opens a block window from the moment of the answer and refuses an early timeout', () => {
    const table = started();
    windowOpened(table);
    const reaction = table.battle.reaction;
    expect(reaction).toBeDefined();
    expect(reaction!.deadlineMs).toBe(table.run.now + BATTLE_RULES.blockWindowMs);
    const early = table.hero({ kind: 'reaction-timeout' }, reaction!.deadlineMs - 1000);
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.code).toBe('TOO_EARLY');
  });

  it('accepts an answer up to the deadline plus the grace and never after it', () => {
    const table = started();
    windowOpened(table);
    const { deadlineMs } = table.battle.reaction!;
    const at = deadlineMs + BATTLE_RULES.networkGraceMs;
    const edge = table.hero({ kind: 'take-hit' }, at);
    expect(edge.ok).toBe(true);
    if (edge.ok) expect(edge.rejected).toBeNull();
  });

  it('settles a window that expired while the tab was closed as a hit, once', () => {
    const table = started();
    windowOpened(table);
    const { deadlineMs } = table.battle.reaction!;
    const hpBefore = creatureById(table.battle, HERO)!.hp;
    const back = deadlineMs + BATTLE_RULES.networkGraceMs + 1;
    const out = ok(table.send({ kind: 'sync', heroId: HERO }, back));
    expect(table.battle.reaction).toBeUndefined();
    expect(out.steps).toHaveLength(1);
    expect(creatureById(table.battle, HERO)!.hp).toBeLessThanOrEqual(hpBefore);
    const again = table.send({ kind: 'sync', heroId: HERO }, back);
    expect(again.ok).toBe(false);
  });

  it('plays an overdue enemy turn exactly once after 60 s of silence, with a fresh window', () => {
    const table = started();
    table.playUntil('enemies');
    const startedAt = table.run.now;
    const back = startedAt + 60_000;
    const out = ok(table.send({ kind: 'sync', heroId: HERO }, back));
    expect(out.steps).toHaveLength(1);
    const turns = out.steps[0].events.filter((event) => event.type === 'TURN_STARTED');
    expect(turns.length).toBeLessThanOrEqual(1);
    if (table.battle.reaction) {
      expect(table.battle.reaction.deadlineMs).toBe(back + BATTLE_RULES.blockWindowMs);
    }
    const again = table.send({ kind: 'sync', heroId: HERO }, back);
    expect(again.ok).toBe(false);
  });

  it('does not play an enemy turn before it is due', () => {
    const table = started();
    table.playUntil('enemies');
    const out = table.send({ kind: 'sync', heroId: HERO }, table.run.now + 5_000);
    expect(out.ok).toBe(false);
  });
});

describe('REQ-SRV-BTL-003 hands are the inventory', () => {
  it('moves the item between the hand and the bag in the same step', () => {
    const table = started();
    table.playUntil('heroes');
    const out = table.hero({ kind: 'set-hands', right: 'health-potion', left: 'wooden-shield' });
    expect(out.ok ? 'ok' : out.code).toBe('ok');
    const { equip, bag } = table.run.inventory;
    expect(equip.weapon?.key).toBe(HEXOBJECT_KEYS.HEALTH_BOTTLE);
    expect(bag.some((cell) => cell?.key === HEXOBJECT_KEYS.SWORD)).toBe(true);
    expect(table.run.inventory.revision).toBeGreaterThan(0);
  });
});

describe('REQ-SRV-BTL-004 closing the battle', () => {
  function won(table: Table, hpLeft = 4): void {
    const battle = structuredClone(table.battle);
    for (const creature of battle.creatures) if (creature.side === 'enemies') creature.hp = 0;
    creatureById(battle, HERO)!.hp = hpLeft;
    creatureById(battle, HERO)!.bag = [];
    battle.outcome = 'victory';
    battle.phase = 'ended';
    table.run = { ...table.run, world: { ...table.run.world, battle } };
  }

  it('removes the squad, counts the kills in progress and spends the used items', () => {
    const table = started();
    won(table);
    const potionsBefore = table.run.inventory.bag.filter(
      (cell) => cell?.key === HEXOBJECT_KEYS.HEALTH_BOTTLE,
    ).length;
    const out = ok(table.send({ kind: 'close', heroId: HERO }));
    expect(potionsBefore).toBe(1);
    expect(findSquad(table.run.world.map, PACK)).toBeNull();
    expect(table.run.world.battle).toBeNull();
    expect(table.run.world.engagement).toBeNull();
    expect(table.run.progress.kills).toBe(2);
    expect(table.run.inventory.bag.some((cell) => cell?.key === HEXOBJECT_KEYS.HEALTH_BOTTLE)).toBe(
      false,
    );
    expect(out.tileDiffs.length).toBeGreaterThan(0);
  });

  it('refuses to close a battle that has not ended, and a defeat bumps the attempts', () => {
    const table = started();
    const early = table.send({ kind: 'close', heroId: HERO });
    expect(early.ok).toBe(false);
    const battle = structuredClone(table.battle);
    creatureById(battle, HERO)!.hp = 0;
    battle.outcome = 'defeat';
    battle.phase = 'ended';
    table.run = { ...table.run, world: { ...table.run.world, battle } };
    ok(table.send({ kind: 'close', heroId: HERO }));
    const squad = findSquad(table.run.world.map, PACK)!;
    expect(squad.squad.creature.attempts).toBe(1);
    expect(table.run.progress.kills).toBe(0);
  });

  it('respawns the hero in the camp on a defeat, in the same answer', () => {
    const table = started();
    const battle = structuredClone(table.battle);
    creatureById(battle, HERO)!.hp = 0;
    battle.outcome = 'defeat';
    battle.phase = 'ended';
    table.run = { ...table.run, world: { ...table.run.world, battle } };
    const out = ok(table.send({ kind: 'close', heroId: HERO }));
    expect(out.respawn?.destination.locationKey).toBe('camping');
    expect(out.respawn?.replaced?.locationKey).toBe('cave');
    expect(out.progress.health.current).toBe(1);
    expect(out.progress.presence?.locationKey).toBe('camping');
    expect(out.events.map((event) => event.type)).toContain('HERO_RESPAWNED');
  });

  it('does not respawn after a victory', () => {
    const table = started();
    won(table);
    const out = ok(table.send({ kind: 'close', heroId: HERO }));
    expect(out.respawn).toBeNull();
    expect(out.progress.health.current).not.toBe(1);
  });
});

describe('REQ-SRV-BTL-005 the map the client gets hides an unscouted squad', () => {
  function squadTile(run: WorldRun) {
    return serializeWorld(run.world).map.tiles.find((tile) => tile.hexobject)!;
  }

  it('keeps the leader and the count, drops the rest and the loot, until SCOUT', () => {
    const run = engaged();
    const raw = squadTile(run);
    const seen = projectTileForClient(raw).hexobject as unknown as {
      creature: { squad: { members: string[]; loot: string } };
    };
    expect(seen.creature.squad.members).toEqual(['skeleton-warrior', 'skeleton-warrior']);
    expect(seen.creature.squad.loot).not.toBe('sword');
    const real = raw.hexobject as unknown as { creature: { squad: { loot: string } } };
    expect(real.creature.squad.loot).toBe('sword');
  });

  it('hides it in the diffs and in the whole world as well, and shows it once scouted', () => {
    const run = engaged();
    const before = snapshotTiles(run.world.map);
    const found = findSquad(run.world.map, PACK)!;
    found.squad.creature.scouted = true;
    const diffs = diffTiles(before, run.world.map);
    expect(JSON.stringify(projectDiffsForClient(diffs))).toContain('"sword"');
    const hidden = engaged();
    const world = projectWorldForClient(serializeWorld(hidden.world));
    expect(JSON.stringify(world.map.tiles)).not.toContain('"loot":"sword"');
    expect(world.battle).toBeNull();
  });
});
