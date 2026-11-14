import { describe, expect, it } from 'vitest';
import HexMapModel, { type ISerializedHexMap } from '../map/models/hex-map-model';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { findSquad } from './squad-state';
import { idAt, squadWorld } from './squad-test-setup';

const AT = { columnIndex: 4, rowIndex: 4 };

describe('REQ-LOOT-108 a map saved before squad.loot was removed still loads', () => {
  it('ignores the old loot key on the squad token and drops it on the next save', () => {
    const state = squadWorld({
      squads: [{ key: HEXOBJECT_KEYS.SKELETON_PACK, at: AT }],
      hero: { columnIndex: 3, rowIndex: 4 },
    });
    const saved = JSON.parse(JSON.stringify(state.map.toJSON())) as ISerializedHexMap;
    const tile = saved.tiles.find(
      (t) =>
        t.coordinates?.columnIndex === AT.columnIndex && t.coordinates.rowIndex === AT.rowIndex,
    )!;
    const squad = (tile.hexobject as unknown as { creature: { squad: Record<string, unknown> } })
      .creature.squad;
    squad.loot = HEXOBJECT_KEYS.SWORD;

    const loaded = HexMapModel.fromJSON(saved, 0);
    const found = findSquad(loaded, idAt(HEXOBJECT_KEYS.SKELETON_PACK, AT));
    expect(found?.squad.creature.squad?.members).toEqual(['skeleton-warrior', 'skeleton-warrior']);
    expect(JSON.stringify(loaded.toJSON())).not.toContain('"loot":"sword"');
  });
});
