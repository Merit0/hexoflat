import { describe, expect, it, vi } from 'vitest';
import type { LootTable } from '../loot/loot-table';

const swap = vi.hoisted(() => ({ table: null as LootTable | null }));

vi.mock('../content/loot-tables.content', async (importOriginal) => {
  const original = await importOriginal<typeof import('../content/loot-tables.content')>();
  return { ...original, lootTableOf: (id: string) => swap.table ?? original.lootTableOf(id) };
});

import { blockAround, chestScene, openAction, runOf } from '../chests/chest-test-setup';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { fullBag } from '../trade/trade-test-setup';
import { actWorld } from '../world';

const GUARANTEED: LootTable = {
  id: 'test-guaranteed',
  rolls: [1, 1],
  guaranteed: [{ itemKey: HEXOBJECT_KEYS.COINS, amount: [20, 20] }],
  entries: [{ itemKey: HEXOBJECT_KEYS.HEALTH_BOTTLE, weight: 1, amount: [1, 1] }],
};

describe('CH-P0 payload snapshot: world chest BAG_FULL refusal events', () => {
  it('no place around, a guaranteed drop and a full bag: LOOT_REJECTED then HEX_ACTION_START_REJECTED', () => {
    swap.table = GUARANTEED;
    const scene = chestScene('golden-3');
    blockAround(scene.world, scene.chest, scene.entry, 0);
    const outcome = actWorld(
      runOf(scene.world, { inventory: fullBag(HEXOBJECT_KEYS.SWORD) }),
      openAction(scene.chest),
    );
    expect(outcome.events).toMatchInlineSnapshot(`
      [
        {
          "payload": {
            "heroId": "hero-1",
            "reason": "BAG_FULL",
          },
          "type": "LOOT_REJECTED",
        },
        {
          "payload": {
            "actionType": "OPEN",
            "coordinates": {
              "columnIndex": 4,
              "rowIndex": 2,
            },
            "message": "Your bag is too full.",
          },
          "type": "HEX_ACTION_START_REJECTED",
        },
      ]
    `);
  });
});
