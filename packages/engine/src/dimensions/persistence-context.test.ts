import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { emptyInventoryState, mintItem } from '../inventory/inventory-state';
import { sampleToken } from '../tokens/token-test-setup';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { serializeState, deserializeState } from '../commands/snapshot';
import { createServerWorld, serializeWorld, deserializeWorld } from '../world/server-world';
import { projectBattleForViewer } from '../battle/projection';
import { fight, warrior } from '../battle/collect-test-setup';
import { HexObjectFactory } from '../factory/hex-object-factory';

describe('D5 persistence source and identity', () => {
  it('preserves owned legacy attributes, ids and generator versions through snapshots', () => {
    const map = new HexMapBuilder().name('dimension-save').width(2).height(1).build();
    const token = sampleToken({
      rarity: ERarityKind.SPARK,
      mapTier: 4,
      generatorVersion: 2,
      attributes: [{ key: 'wisdom', value: 2 }],
    });
    const inventory = emptyInventoryState('hero');
    inventory.equip.weapon = { ...mintItem(inventory, 'sword', 1), token };
    map.tiles[0].hexobject = HexObjectFactory.create('sword', map.tiles[0].coordinates, { token });
    const legacy: Record<string, unknown> = { ...token };
    delete legacy.dimension;
    delete legacy.baseKey;
    Object.assign(inventory.equip.weapon, { token: legacy });
    Object.assign(map.tiles[0].hexobject, { token: legacy });
    const payload = serializeState({ map, heroes: {}, inventory });
    const restored = deserializeState(payload, 0);
    expect(restored.inventory!.equip.weapon!.token).toEqual(token);
    expect(restored.map.tiles[0].hexobject!.token).toEqual(token);
    expect(deserializeState(serializeState(restored), 0).inventory).toEqual(restored.inventory);
  });

  it('fills missing battle source from its saved world while retaining an existing source', () => {
    const world = createServerWorld('cave', 'legacy-battle', 'private-world-seed', 'hero');
    const battle = fight([warrior('w', { q: 1, r: 0 })]);
    delete battle.tokenOrigin;
    world.battle = battle;
    world.tokenOrigin = { realm: ERarityKind.GLOOM, mapTier: 4 };
    const restored = deserializeWorld(serializeWorld(world), 0);
    expect(restored.battle!.tokenOrigin).toEqual(world.tokenOrigin);
    const view = projectBattleForViewer(restored.battle!, 'heroes');
    expect(view.dimension).toBe('underworld');
    expect(view).not.toHaveProperty('tokenOrigin');
    expect(view).not.toHaveProperty('tokenSecret');
    expect(view).not.toHaveProperty('seed');
    restored.battle!.tokenOrigin = { realm: ERarityKind.IDOL, mapTier: 2 };
    const again = deserializeWorld(serializeWorld(restored), 0);
    expect(again.battle!.tokenOrigin).toEqual({ realm: 'idol', mapTier: 2 });
  });
});
