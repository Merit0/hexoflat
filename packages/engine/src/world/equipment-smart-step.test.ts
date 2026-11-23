import { describe, expect, it } from 'vitest';
import { AttributeRegistry } from '../tokens/registries';
import { attributeFailure } from '../tokens/attribute-rules';
import { emptyProgressState } from '../aggregates/progress-state';
import { AGGREGATES, upcastAggregate } from '../aggregates/registry';
import { executePlayerCommand } from '../aggregates/execute-player-command';
import { PLAYER_COMMAND_AGGREGATES, playerCommandAggregate } from '../aggregates/player-commands';
import { fogInventory } from '../map/hero-fog-test-setup';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { runOf } from '../chests/chest-test-setup';
import { resolveHeroStats } from '../tokens/equipment/hero-stats';
import { EQUIPMENT_ATTRIBUTES } from '../content/equipment-attributes.content';
import { EQUIPMENT_TYPES } from '../content/item-types.content';
import { ATTRIBUTE_PROFILES } from '../content/attribute-profiles.content';
import {
  createEquipmentAttributeGenerator,
  seededRandomStreams,
} from '../tokens/equipment/generator';
import { createServerWorld, deserializeWorld, serializeWorld } from './server-world';
import type { WorldRun } from './world-commands';
import { stepWorld } from './world-commands';

function equipment(every: number, equipped = true) {
  const inventory = fogInventory(every, equipped);
  const item = equipped ? inventory.equip.helm! : inventory.bag[0]!;
  item.token!.attributes = [{ key: 'smart-step', value: every }];
  return inventory;
}

function scene(every = 5, equipped = true): WorldRun {
  const world = createServerWorld('silesia', 'smart-step', 'seed', 'hero-1');
  world.map = new HexMapBuilder().name('steps').width(5).height(5).build();
  for (const tile of world.map.tiles) tile.isRevealed = true;
  world.heroCoordinates = { columnIndex: 2, rowIndex: 2 };
  return runOf(world, { inventory: equipment(every, equipped) });
}

function walk(run: WorldRun): WorldRun {
  const target = {
    columnIndex: run.world.heroCoordinates!.columnIndex === 2 ? 3 : 2,
    rowIndex: 2,
  };
  const outcome = stepWorld(run, target);
  if (!outcome.ok) throw new Error(outcome.code);
  return { ...run, world: outcome.world, progress: outcome.progress, inventory: outcome.inventory };
}

describe('A04 Smart Step', () => {
  it.each([2, 3, 4, 5])('makes every %s-th paid-zone step free', (every) => {
    let run = scene(every);
    const initialWill = run.progress.knowledge.current;
    for (let index = 0; index < 10; index++) run = walk(run);
    expect(initialWill - run.progress.knowledge.current).toBe(10 - Math.floor(10 / every));
  });

  it('EA-11: waives four of twenty steps and persists the phase across reload', () => {
    let run = scene();
    const costs: number[] = [];
    for (let index = 0; index < 20; index++) {
      const before = run.progress.knowledge.current;
      run = walk(run);
      costs.push(before - run.progress.knowledge.current);
      run = {
        ...run,
        progress: AGGREGATES.progress.schema.parse(JSON.parse(JSON.stringify(run.progress))),
        world: deserializeWorld(JSON.parse(JSON.stringify(serializeWorld(run.world))), 0),
      };
    }
    expect(costs).toEqual([1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0]);
    expect(run.progress).toMatchObject({ steps: 20, paidSteps: 20, knowledge: { current: 34 } });
  });

  it('counts paid-zone steps without gear, ignores bag attributes and keeps the phase on swaps', () => {
    let run = scene(5, false);
    for (let index = 0; index < 4; index++) run = walk(run);
    expect(run.progress.knowledge.current).toBe(46);
    run.inventory = equipment(5);
    run = walk(run);
    expect(run.progress.knowledge.current).toBe(46);
    run.inventory = equipment(3);
    run = walk(run);
    expect(run.progress.knowledge.current).toBe(46);
    run.inventory = equipment(1, false);
    run = walk(run);
    expect(run.progress).toMatchObject({ paidSteps: 7, knowledge: { current: 45 } });
  });

  it('camp steps leave paidSteps unchanged, and the next world step keeps its phase', () => {
    let run = scene();
    run.progress.paidSteps = 4;
    run.world.locationKey = 'camping';
    run = walk(run);
    expect(run.progress).toMatchObject({ steps: 1, paidSteps: 4, knowledge: { current: 50 } });
    run.world.locationKey = 'silesia';
    run = walk(run);
    expect(run.progress).toMatchObject({ steps: 2, paidSteps: 5, knowledge: { current: 50 } });
  });

  it('allows a free fifth step at zero Will, then refuses without mutating state', () => {
    let run = scene();
    run.progress.paidSteps = 4;
    run.progress.knowledge.current = 0;
    run = walk(run);
    const before = structuredClone(run.progress);
    expect(stepWorld(run, { columnIndex: 2, rowIndex: 2 })).toMatchObject({
      ok: false,
      code: 'INSUFFICIENT_WILL',
    });
    expect(run.progress).toEqual(before);
    expect(run.progress.paidSteps).toBe(5);
    expect(stepWorld(run, { columnIndex: 0, rowIndex: 0 }).ok).toBe(false);
    expect(run.progress).toEqual(before);
  });

  it('direct progress commands use the server inventory and counter too', () => {
    expect(PLAYER_COMMAND_AGGREGATES.KNOWLEDGE).toEqual(['inventory', 'progress']);
    expect(playerCommandAggregate('KNOWLEDGE')).toBe('progress');
    const run = scene();
    run.progress.presence = {
      locationKey: 'silesia',
      mapId: 'smart-step',
      coordinates: { columnIndex: 2, rowIndex: 2 },
    };
    run.progress.paidSteps = 4;
    run.progress.knowledge.current = 0;
    const result = executePlayerCommand(
      run,
      {
        type: 'KNOWLEDGE',
        payload: {
          heroId: run.heroId,
          revision: 0,
          action: { kind: 'step', target: { columnIndex: 3, rowIndex: 2 } },
        },
      },
      { devGrantAllowed: false, inventory: { stashOpen: false, battleOpen: false } },
    );
    expect(result.ok && result.changed.progress).toMatchObject({
      paidSteps: 5,
      knowledge: { current: 0 },
    });
  });
});

describe('A04 content and progress compatibility', () => {
  it('upcasts v10 additively without changing existing progress', () => {
    const old: Partial<ReturnType<typeof emptyProgressState>> = emptyProgressState('hero-1');
    delete old.paidSteps;
    old.steps = 123;
    old.kills = 7;
    old.ownedUniques = ['lantern-eater'];
    expect(AGGREGATES.progress.schemaVersion).toBe(11);
    expect(upcastAggregate('progress', 10, old, { heroId: 'hero-1' })).toEqual({
      ...old,
      paidSteps: 0,
    });
  });

  it('uses the smallest equipped N, including deprecated owned attributes', () => {
    const items = [equipment(5).equip.helm!, equipment(2).equip.helm!];
    const attributes = EQUIPMENT_ATTRIBUTES.map((entry) =>
      entry.key === 'smart-step' ? { ...entry, deprecated: true } : entry,
    );
    expect(resolveHeroStats(items).stepFreeEvery).toBe(2);
    expect(resolveHeroStats(items, { attributes, types: EQUIPMENT_TYPES }).stepFreeEvery).toBe(2);
    expect(resolveHeroStats([equipment(1).equip.helm!]).stepFreeEvery).toBe(1);
  });

  it('rolls the approved tier ranges on boots only, without enabling the type', () => {
    const generator = createEquipmentAttributeGenerator(
      new AttributeRegistry(EQUIPMENT_ATTRIBUTES),
      ATTRIBUTE_PROFILES,
    );
    const boots = EQUIPMENT_TYPES.find((type) => type.key === 'boots')!;
    expect(boots.enabled).toBe(false);
    for (const level of [1, 2, 3, 4] as const) {
      const values = new Set<number>();
      for (let seed = 0; seed < 500; seed++) {
        const rolled = generator.generate({
          level,
          group: boots.group,
          type: boots,
          tokenId: `boots:${seed}`,
          rng: seededRandomStreams(`step:${seed}`),
        });
        const step = rolled.find((attribute) => attribute.key === 'smart-step');
        if (step) values.add(step.value);
      }
      const registry = new AttributeRegistry(EQUIPMENT_ATTRIBUTES);
      const check = { origin: 'base', profiles: ATTRIBUTE_PROFILES } as const;
      for (const value of values) {
        expect(
          attributeFailure(registry, boots, { key: 'smart-step', value }, check, level),
        ).toBeNull();
      }
      for (const value of [5 - level, 6]) {
        expect(
          attributeFailure(registry, boots, { key: 'smart-step', value }, check, level),
        ).not.toBeNull();
      }
      expect([...values].sort()).toEqual([[5], [4, 5], [3, 4, 5], [2, 3, 4, 5]][level - 1]);
    }
    for (const type of EQUIPMENT_TYPES.filter((entry) => entry.key !== 'boots')) {
      for (let seed = 0; seed < 30; seed++) {
        expect(
          generator
            .generate({
              level: 4,
              group: type.group,
              type,
              tokenId: `${type.key}:${seed}`,
              rng: seededRandomStreams(`step:${seed}`),
            })
            .some((attribute) => attribute.key === 'smart-step'),
        ).toBe(false);
      }
    }
  });
});
