import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { fakeCurrentWorld, fakeHeroId } from './fake-player-server';

export function fakeEngageSquad(at: { columnIndex: number; rowIndex: number }) {
  const held = fakeCurrentWorld()!;
  const tile = held.map.tiles.find(
    (t) => t.coordinates.columnIndex === at.columnIndex && t.coordinates.rowIndex === at.rowIndex,
  )!;
  tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.SKELETON_PACK, tile.coordinates);
  held.engagement = {
    squadId: `${at.columnIndex}:${at.rowIndex}:skeleton-pack`,
    ambush: false,
    heroAt: { ...held.heroCoordinates! },
    heroIds: [fakeHeroId()],
    startItems: {},
  };
  return held.engagement;
}

export function fakeEndBattle(outcome: 'victory' | 'defeat') {
  const battle = fakeCurrentWorld()!.battle!;
  const loser = outcome === 'victory' ? 'enemies' : 'heroes';
  for (const creature of battle.creatures) if (creature.side === loser) creature.hp = 0;
  battle.outcome = outcome;
  battle.phase = 'ended';
}
