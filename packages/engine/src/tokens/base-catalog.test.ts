import { ACTION_FINISHERS } from '../registry/action-finishers-registry';
import { EHexActionType } from '../enums/hex-action-type';
import { createContext } from '../commands/command-test-context';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { locationDropContext } from '../registry/location-drop-context';
import { describe, expect, it } from 'vitest';
import { createTokenFactory } from './factory/create-token-factory';
import { TOKEN_CONTENT } from '../content/token-content';
import { EDimension } from '../dimensions/dimensions';
import { createServerWorld } from '../world/server-world';
import { rollChestLoot } from '../chests/plan-chest-loot';
import { generateChestDrop } from '../quests/seeker-chest';
import { stockTokenSupply } from '../inventory/stock-token-supply';
import { emptyInventoryState } from '../inventory/inventory-state';

const base = TOKEN_CONTENT.baseItems[0];

describe('catalogue validation and generation context', () => {
  it.each([
    { baseItems: [base, base] },
    { baseItems: [{ ...base, type: 'unknown' }] },
    { baseItems: [{ ...base, dimension: EDimension.NOWHERE }] },
    { baseItems: [{ ...base, attributes: ['unknown'] }] },
    { baseItems: [{ ...base, attributes: ['heart', 'heart'] }] },
  ])('refuses invalid authored catalogue entries at construction', (changes) => {
    expect(() => createTokenFactory({ ...TOKEN_CONTENT, ...changes })).toThrow();
  });

  it('does not enable disabled type mechanics through a new base definition', () => {
    expect(() =>
      createTokenFactory({
        ...TOKEN_CONTENT,
        types: TOKEN_CONTENT.types.map((type) => ({ ...type, enabled: false })),
      }),
    ).toThrow('Disabled base item type');
  });

  it('requires trusted scope for new chest, quest and inventory generation', () => {
    const world = createServerWorld('cave', 'scope-map', 'scope-seed', 'hero');
    const chest = world.map.tiles.find((tile) => tile.hexobject?.hexobjectKey === 'chest')!;
    expect(() => rollChestLoot(chest, { seed: 'secret', sourceId: 'map' })).toThrow(
      'TOKEN_ORIGIN_REQUIRED',
    );
    expect(() =>
      generateChestDrop({
        seed: 'secret',
        chestHex: chest.coordinates,
        tableId: 'seeker-1-chest-loot',
      }),
    ).toThrow('TOKEN_ORIGIN_REQUIRED');
    expect(
      stockTokenSupply(emptyInventoryState('hero'), { seed: 'secret', sourceId: 'map' }),
    ).toBeUndefined();
  });
});

describe('ownership during raw legacy pickup', () => {
  it('materializes an existing EARTH object without recoloring it in UNDERWORLD', () => {
    const map = new HexMapBuilder().name('pickup').width(2).height(1).build();
    const tile = map.tiles[0];
    tile.hexobject = HexObjectFactory.create('sword', tile.coordinates);
    const inventory = { current: emptyInventoryState('hero'), events: [] };
    const result = ACTION_FINISHERS[EHexActionType.TAKE](
      tile,
      {
        type: EHexActionType.TAKE,
        startedAt: 0,
        endsAt: 1,
        hexobjectKey: 'sword',
      },
      {
        ...createContext(),
        map,
        now: 1,
        inventory,
        loot: {
          seed: 'secret',
          sourceId: 'underworld-map',
          dropContext: locationDropContext('cave'),
        },
      },
    );
    expect(result).toBe(true);
    expect(inventory.current.bag[0]!.token).toMatchObject({
      baseKey: 'earth-sword',
      dimension: 'earth',
      tokenType: 'idol',
    });
    expect(tile.hexobject).toBeNull();
  });
});
