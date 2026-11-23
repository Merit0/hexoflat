import { describe, expect, it } from 'vitest';
import { emptyProgressState } from '../aggregates/progress-state';
import { WORLD_COMMAND_SCHEMAS } from '../aggregates/world-player-commands';
import { EHexActionType } from '../enums/hex-action-type';
import { emptyInventoryState, mintItem } from '../inventory/inventory-state';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { HERO, hexAction, squadWorld } from '../squads/squad-test-setup';
import { battleWorld, createServerWorld, deserializeWorld, serializeWorld } from './index';
import type { ServerWorld } from './index';

const SQUAD_AT = { columnIndex: 4, rowIndex: 4 };

function startedWorld(): ServerWorld {
  const state = squadWorld({
    squads: [{ key: HEXOBJECT_KEYS.SKELETON_PACK, at: SQUAD_AT }],
    hero: { columnIndex: 3, rowIndex: 4 },
  });
  hexAction(state, EHexActionType.ATTACK, SQUAD_AT);
  const inventory = emptyInventoryState(HERO);
  inventory.equip.weapon = mintItem(inventory, HEXOBJECT_KEYS.SWORD, 1);
  const outcome = battleWorld(
    {
      world: {
        locationKey: 'cave',
        mapId: 'map-1',
        map: state.map,
        descriptor: null,
        heroCoordinates: { columnIndex: 3, rowIndex: 4 },
        worldSeed: 'seed-1',
        engagement: state.engagement ?? null,
        battle: null,
      },
      progress: emptyProgressState(HERO),
      inventory,
      heroId: HERO,
      now: 10_000,
      loadStored: () => null,
      loadById: () => null,
      create: (key) => createServerWorld(key, `fresh-${key}`, 'expedition', HERO),
    },
    { kind: 'start', heroId: HERO },
  );
  if (!outcome.ok) throw new Error(`refused: ${outcome.code}`);
  return outcome.world;
}

describe('test override of the hero base crit chance on the server', () => {
  it('a battle started on the server has no override', () => {
    expect(startedWorld().battle!.critOverride).toBeUndefined();
  });

  it('a client cannot send an override in any battle command', () => {
    const schema = WORLD_COMMAND_SCHEMAS.WORLD_BATTLE;
    const critOverride = { heroBaseCrit: 0 };
    const start = { kind: 'start', heroId: HERO };
    const hero = { kind: 'hero', heroId: HERO, action: { kind: 'end-turn' } };
    for (const payload of [start, hero]) {
      expect(schema.safeParse({ type: 'WORLD_BATTLE', payload }).success).toBe(true);
      expect(
        schema.safeParse({ type: 'WORLD_BATTLE', payload: { ...payload, critOverride } }).success,
      ).toBe(false);
    }
    const action = { ...hero.action, critOverride };
    const parsed = schema.safeParse({ type: 'WORLD_BATTLE', payload: { ...hero, action } });
    expect(JSON.stringify(parsed.data)).not.toContain('critOverride');
  });

  it('keeps a fixture override through the world document', () => {
    const world = startedWorld();
    world.battle!.critOverride = { heroBaseCrit: 0 };
    const loaded = deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(world))), 0);
    expect(loaded.battle?.critOverride).toEqual({ heroBaseCrit: 0 });
  });
});
