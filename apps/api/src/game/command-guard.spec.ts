import { describe, expect, it } from 'vitest';
import type { HexEngineCommand } from '@hexoflat/engine';
import { commandRefusal } from './command-guard';

const move = (heroId: string): HexEngineCommand => ({
  type: 'MOVE_ITEM',
  payload: {
    heroId,
    revision: 0,
    from: { container: 'bag', index: 0 },
    to: { container: 'bag', index: 1 },
    split: false,
  },
});

describe('commandRefusal', () => {
  it('lets a player move the items of the hero they control', () => {
    expect(commandRefusal(move('h1'), 'h1')).toBeNull();
  });

  it('refuses inventory commands for another hero', () => {
    expect(commandRefusal(move('h2'), 'h1')).toMatch(/do not control/);
    for (const type of ['SORT_STASH', 'STORE_RESOURCES', 'UNLOCK_STASH_CHEST'] as const) {
      const other = { type, payload: { heroId: 'h2', revision: 0 } } as HexEngineCommand;
      expect(commandRefusal(other, 'h1')).toMatch(/do not control/);
    }
  });

  it('refuses a client that has no hero in the scenario', () => {
    expect(commandRefusal(move('h1'), undefined)).toMatch(/do not control/);
  });

  it('never accepts grants or consumption from a client, even for its own hero', () => {
    const grant = {
      type: 'GRANT_ITEM',
      payload: { heroId: 'h1', revision: 0, key: 'coins', amount: 999, source: 'dev' },
    } as HexEngineCommand;
    const consume = {
      type: 'CONSUME_ITEM',
      payload: { heroId: 'h1', revision: 0, key: 'coins', amount: 1 },
    } as HexEngineCommand;
    expect(commandRefusal(grant, 'h1')).toMatch(/only sent by the server/);
    expect(commandRefusal(consume, 'h1')).toMatch(/only sent by the server/);
  });

  it('keeps the old rule for movement and leaves world commands alone', () => {
    const moveHero = {
      type: 'MOVE_HERO',
      payload: { heroId: 'h2', target: { columnIndex: 0, rowIndex: 0 } },
    } as HexEngineCommand;
    expect(commandRefusal(moveHero, 'h1')).toMatch(/do not control/);
    expect(commandRefusal({ type: 'WORLD_TICK', payload: { now: 1 } }, 'h1')).toBeNull();
  });
});
