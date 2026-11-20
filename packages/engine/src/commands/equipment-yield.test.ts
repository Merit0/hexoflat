import { describe, expect, it, vi } from 'vitest';
import { EHexActionType } from '../enums/hex-action-type';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { emptyInventoryState, mintItem } from '../inventory/inventory-state';
import { upcastToken } from '../inventory/upcast-item-tokens';
import { applyCommand } from './apply-command';
import { createContext, toState } from './command-test-context';
import HexMapModel from '../map/models/hex-map-model';

const HERO = 'hero-1';

function setup(type: 'CUT' | 'MINE', bonus = 0) {
  const tool = type === 'CUT' ? 'axe' : 'pickaxe';
  const resource = type === 'CUT' ? 'tree' : 'rock';
  const map = new HexMapBuilder().name('yield-test').width(2).height(1).build();
  const tile = map.tiles[0];
  tile.hexobject = HexObjectFactory.create(resource, tile.coordinates);
  const state = toState(map);
  state.inventory = emptyInventoryState(HERO);
  state.inventory.equip.weapon = {
    ...mintItem(state.inventory, tool, 1),
    token: {
      ...upcastToken(HERO, 'tool', tool)!,
      attributes: bonus ? [{ key: 'yield', value: bonus }] : [],
    },
  };
  const ctx = createContext();
  ctx.heroToolStore.addTreeCut = vi.fn();
  ctx.heroToolStore.collectStones = vi.fn();
  ctx.heroToolStore.stoneCollected = 1;
  const start = () =>
    applyCommand(
      state,
      {
        type: 'START_HEX_ACTION',
        payload: {
          heroId: HERO,
          coordinates: tile.coordinates,
          actionType: EHexActionType[type],
          toolKey: tool,
          now: 0,
        },
      },
      ctx,
    );
  const finish = () =>
    applyCommand(state, { type: 'FINISH_PENDING_ACTIONS', payload: { now: 60_000 } }, ctx);
  return { state, ctx, tile, start, finish, resource };
}

describe('A08 harvest characterization', () => {
  it.each(['CUT', 'MINE'] as const)(
    '%s gathers its base amount once and emits the quest amount',
    (type) => {
      const test = setup(type);
      const base = type === 'CUT' ? 1 : 10;
      expect(test.start().events[0].type).toBe('HEX_ACTION_STARTED');
      const result = test.finish();
      expect(result.events).toContainEqual({
        type: 'RESOURCE_GATHERED',
        payload: {
          action: type,
          hexobjectKey: test.resource,
          amount: base,
        },
      });
      expect(test.ctx.gathering.add).toHaveBeenCalledWith(test.resource, base);
      test.finish();
      expect(test.ctx.gathering.add).toHaveBeenCalledTimes(1);
    },
  );

  it('a cancelled action gives no resource or quest progress', () => {
    const test = setup('CUT');
    test.start();
    test.tile.pendingAction!.cancelled = true;
    expect(test.finish().events.some((event) => event.type === 'RESOURCE_GATHERED')).toBe(false);
    expect(test.ctx.gathering.add).not.toHaveBeenCalled();
  });
});

describe('A08 item-scoped harvest bonus', () => {
  it.each([
    { type: 'CUT', bonus: 1, amount: 2, base: 1 },
    { type: 'CUT', bonus: 2, amount: 3, base: 1 },
    { type: 'MINE', bonus: 1, amount: 11, base: 10 },
    { type: 'MINE', bonus: 2, amount: 12, base: 10 },
  ] as const)(
    '$type +$bonus grants $amount while the quest event keeps $base',
    ({ type, bonus, amount, base }) => {
      const test = setup(type, bonus);
      test.start();
      const result = test.finish();
      expect(test.ctx.gathering.add).toHaveBeenCalledWith(test.resource, amount);
      expect(
        type === 'CUT' ? test.ctx.heroToolStore.addTreeCut : test.ctx.heroToolStore.collectStones,
      ).toHaveBeenCalledWith(amount);
      expect(result.events).toContainEqual({
        type: 'RESOURCE_GATHERED',
        payload: {
          action: type,
          hexobjectKey: test.resource,
          amount: base,
        },
      });
      test.finish();
      expect(test.ctx.gathering.add).toHaveBeenCalledTimes(1);
    },
  );

  it('does not read the bag or a different equipped tool', () => {
    const test = setup('CUT', 2);
    test.state.inventory!.bag[0] = test.state.inventory!.equip.weapon;
    test.state.inventory!.equip.weapon = null;
    test.start();
    test.finish();
    expect(test.ctx.gathering.add).toHaveBeenCalledWith('tree', 1);
    const other = setup('MINE', 2);
    other.state.inventory!.equip.weapon!.key = 'axe';
    other.start();
    other.finish();
    expect(other.ctx.gathering.add).toHaveBeenCalledWith('rock', 10);
  });

  it('reads the exact equipped item, without summing two tools of the same type', () => {
    const test = setup('CUT');
    const inventory = test.state.inventory!;
    inventory.equip.shield = {
      ...mintItem(inventory, 'axe', 1),
      token: {
        ...upcastToken(HERO, 'second', 'axe')!,
        attributes: [{ key: 'yield', value: 2 }],
      },
    };
    test.ctx.heroToolStore.activeItemId = inventory.equip.shield.id;
    test.start();
    test.finish();
    expect(test.ctx.gathering.add).toHaveBeenCalledWith('tree', 3);
    const foreign = setup('CUT', 2);
    foreign.ctx.heroToolStore.activeItemId = 'unowned';
    foreign.start();
    foreign.finish();
    expect(foreign.ctx.gathering.add).toHaveBeenCalledWith('tree', 1);
  });

  it('captures a capped bonus at start and retains it through save/load and an equipment swap', () => {
    const test = setup('CUT', 9);
    test.start();
    expect(test.tile.pendingAction!.harvestBonus).toBe(2);
    test.state.inventory!.equip.weapon = null;
    const saved = JSON.parse(JSON.stringify(test.state.map.toJSON())) as ReturnType<
      HexMapModel['toJSON']
    >;
    test.state.map = HexMapModel.fromJSON(saved, 1000);
    test.finish();
    expect(test.ctx.gathering.add).toHaveBeenCalledWith('tree', 3);
    expect(test.tile.pendingAction!.harvestBonus).toBe(2);
  });

  it('does not retrofit bonuses to old pending actions or grant anything for cancelled work', () => {
    const test = setup('CUT', 2);
    test.start();
    delete test.tile.pendingAction!.harvestBonus;
    test.finish();
    expect(test.ctx.gathering.add).toHaveBeenCalledWith('tree', 1);
    const cancelled = setup('MINE', 2);
    cancelled.start();
    cancelled.tile.pendingAction!.cancelled = true;
    expect(cancelled.finish().events.some((event) => event.type === 'RESOURCE_GATHERED')).toBe(
      false,
    );
    expect(cancelled.ctx.gathering.add).not.toHaveBeenCalled();
  });
});
