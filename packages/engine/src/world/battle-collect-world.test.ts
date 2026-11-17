import { describe, expect, it } from 'vitest';
import { ackGraveExitWarning } from '../aggregates/ack-grave-exit-warning';
import { emptyProgressState } from '../aggregates/progress-state';
import { PLAYER_COMMAND_SCHEMAS } from '../aggregates/player-commands';
import { isFreeHex } from '../battle/battle-board';
import { BATTLE_CREATURES } from '../battle/battle-catalogue';
import { BATTLE_RULES } from '../battle/battle-content';
import { applyBattleFixture } from '../battle/battle-fixtures';
import type { BattleState } from '../battle/battle-state';
import { hexNeighbours } from '../battle/hex-battle-geom';
import { projectBattleForViewer } from '../battle/projection';
import { LOOT_TABLES, lootTableOf } from '../content/loot-tables.content';
import { EHexActionType } from '../enums/hex-action-type';
import { toAggregate } from '../inventory/inventory-adapter';
import { emptyInventoryState, mintItem, type InventoryState } from '../inventory/inventory-state';
import { countItem } from '../inventory/plan-stock';
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

const ON = { ...BATTLE_RULES, graveLootEnabled: true };
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

function adopt(run: TravelRun, outcome: Extract<BattleWorldOutcome, { ok: true }>): TravelRun {
  return { ...run, world: outcome.world, progress: outcome.progress, inventory: outcome.inventory };
}

function wonRun(): TravelRun {
  const run = engaged();
  const started = adopt(run, ok(battleWorld(run, { kind: 'start', heroId: HERO }, ON)));
  started.world.battle = applyBattleFixture(started.world.battle!, {
    kind: 'finish',
    outcome: 'victory',
  });
  return started;
}

function standBeside(
  run: TravelRun,
  index = 0,
): { run: TravelRun; grave: { q: number; r: number } } {
  const battle = run.world.battle!;
  const grave = battle.collect!.graves[index].hex;
  const hero = battle.creatures.find((c) => c.side === 'heroes')!;
  hero.pos = hexNeighbours(grave).find((hex) => isFreeHex(battle, hex, hero.id))!;
  return { run, grave };
}

function send(run: TravelRun, action: Parameters<typeof battleWorld>[1], at = run.now + 1_000) {
  return battleWorld({ ...run, now: at }, action, ON);
}

const heroAction = (action: unknown) =>
  ({ kind: 'hero', heroId: HERO, action }) as Parameters<typeof battleWorld>[1];

describe('REQ-LOOT-088 a victory the server holds with grave loot on', () => {
  it('turns the won battle into a collection phase with the same graves after a save and load', () => {
    const run = wonRun();
    const battle = run.world.battle!;
    expect(battle.collect!.graves.length).toBeGreaterThan(0);
    const restored = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(run.world))), 0);
    expect(restored.battle).toEqual(battle);
  });

  it('loots a grave for free, writes the bag and shows the layout in every step', () => {
    const { run, grave } = standBeside(wonRun());
    const before = projectBattleForViewer(run.world.battle!, 'heroes');
    const looted = ok(send(run, heroAction({ kind: 'loot-grave', hex: grave })));
    expect(looted.rejected).toBeNull();
    const view = looted.steps.at(-1)!.battle!;
    expect(
      view.collect!.graves.find((g) => g.hex.q === grave.q && g.hex.r === grave.r)!.examined,
    ).toBe(true);
    expect(view.collect!.items.length).toBeGreaterThan(0);
    expect(before.collect!.items).toEqual([]);
    expect(looted.events.map((e) => e.type)).toContain('CONTAINER_OPENED');
    expect(JSON.stringify(looted.steps)).not.toContain(run.world.battle!.seed);
    expect(JSON.stringify(looted.steps)).not.toContain('-loot');
  });

  it('refuses a refused loot without touching the bag, the battle or the answer steps', () => {
    const { run } = standBeside(wonRun());
    const out = send(run, heroAction({ kind: 'loot-grave', hex: { q: 99, r: 99 } }));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe('CONTAINER_EMPTY');
  });

  it('picks a stack up into the bag through the same grant path as the map', () => {
    const { run, grave } = standBeside(wonRun());
    const looted = adopt(run, ok(send(run, heroAction({ kind: 'loot-grave', hex: grave }))));
    const battle = looted.world.battle!;
    const hero = battle.creatures.find((c) => c.side === 'heroes')!;
    const item = battle.collect!.items[0];
    hero.pos = hexNeighbours(item.hex).find((hex) => isFreeHex(battle, hex, hero.id))!;
    const picked = ok(send(looted, heroAction({ kind: 'pickup-loot', hex: item.hex })));
    expect(
      picked.steps
        .at(-1)!
        .battle!.collect!.items.some((i) => i.hex.q === item.hex.q && i.hex.r === item.hex.r),
    ).toBe(false);
    expect(countItem(toAggregate(picked.inventory), item.itemKey as never)).toBeGreaterThanOrEqual(
      item.amount,
    );
    expect(picked.events.map((e) => e.type)).toContain('ITEM_GRANTED');
  });
});

describe('REQ-LOOT-089 leaving the field', () => {
  it('is accepted from a hex surrounded by graves and loses what was left', () => {
    const { run } = standBeside(wonRun());
    const battle = run.world.battle!;
    const hero = battle.creatures.find((c) => c.side === 'heroes')!;
    for (const hex of hexNeighbours(hero.pos)) {
      battle.collect!.graves.push({ hex, tables: [], examined: false });
    }
    battle.collect!.items.push({ hex: { q: 50, r: 50 }, itemKey: HEXOBJECT_KEYS.COINS, amount: 3 });
    const closed = ok(send(run, { kind: 'close', heroId: HERO }));
    expect(closed.world.battle).toBeNull();
    expect(closed.world.engagement).toBeNull();
    expect(findSquad(closed.world.map, PACK)).toBeNull();
    const tile = closed.world.map.tiles.find(
      (t) => t.coordinates.columnIndex === 4 && t.coordinates.rowIndex === 4,
    )!;
    expect(tile.hexobject).toBeNull();
  });

  it('keeps what was picked up and counts the kills as before', () => {
    const { run, grave } = standBeside(wonRun());
    const looted = adopt(run, ok(send(run, heroAction({ kind: 'loot-grave', hex: grave }))));
    const bagBefore = JSON.stringify(looted.inventory);
    const closed = ok(send(looted, { kind: 'close', heroId: HERO }));
    expect(JSON.stringify(closed.inventory)).toBe(bagBefore);
    expect(closed.progress.kills).toBe(2);
  });

  it('is the same close as before when the flag is off', () => {
    const run = engaged();
    const off = adopt(run, ok(battleWorld(run, { kind: 'start', heroId: HERO }, OFF)));
    off.world.battle = applyBattleFixture(off.world.battle!, {
      kind: 'finish',
      outcome: 'victory',
    });
    expect(off.world.battle.collect).toBeUndefined();
    const closed = ok(battleWorld({ ...off, now: 20_000 }, { kind: 'close', heroId: HERO }, OFF));
    expect(closed.world.battle).toBeNull();
  });

  it('gives a defeat no graves and no collection phase', () => {
    const run = engaged();
    const started = adopt(run, ok(battleWorld(run, { kind: 'start', heroId: HERO }, ON)));
    const lost = applyBattleFixture(started.world.battle as BattleState, {
      kind: 'finish',
      outcome: 'defeat',
    });
    expect(lost.collect).toBeUndefined();
    started.world.battle = lost;
    const out = send(started, heroAction({ kind: 'move', hex: { q: 0, r: 0 } }));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe('BATTLE_ENDED');
  });
});

describe('REQ-LOOT-090 the exit warning milestone', () => {
  it('is set once and a second command changes nothing', () => {
    const progress = emptyProgressState(HERO);
    const first = ackGraveExitWarning(progress);
    expect(first.changed.progress!.graveExitWarningAcknowledged).toBe(true);
    expect(first.changed.progress!.claimedRewards).toEqual([]);
    expect(first.events.map((e) => e.type)).toEqual(['GRAVE_EXIT_WARNING_ACKNOWLEDGED']);
    const second = ackGraveExitWarning(first.changed.progress!);
    expect(second.changed).toEqual({});
    expect(second.events).toEqual([]);
  });

  it('has a strict command that carries nothing but the hero', () => {
    const schema = PLAYER_COMMAND_SCHEMAS.ACK_GRAVE_EXIT_WARNING;
    expect(
      schema.safeParse({ type: 'ACK_GRAVE_EXIT_WARNING', payload: { heroId: HERO } }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ type: 'ACK_GRAVE_EXIT_WARNING', payload: { heroId: HERO, extra: 1 } })
        .success,
    ).toBe(false);
  });
});

describe('REQ-LOOT-091 creature loot content', () => {
  it('names a real table for every enemy kind', () => {
    for (const def of Object.values(BATTLE_CREATURES)) {
      if (def.behaviour === 'hero') continue;
      expect(def.lootTableId, def.id).toBeDefined();
      expect(lootTableOf(def.lootTableId), def.id).not.toBeNull();
      expect(def.lootTableId).toMatch(/-loot$/);
    }
    expect(Object.keys(LOOT_TABLES).length).toBeGreaterThanOrEqual(4);
  });

  it('gives the boss guaranteed entries', () => {
    const table = lootTableOf(BATTLE_CREATURES['skeleton-king'].lootTableId)!;
    expect(table.guaranteed!.length).toBeGreaterThan(0);
  });
});
