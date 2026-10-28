import type { BattleCreature } from '@hexoflat/engine/battle/battle-state';
import { hexagonBoard } from '@hexoflat/engine/battle/battle-test-setup';
import type { BattleDeploy } from './battle-store';

export function testDeploy(creatures: BattleCreature[], board = hexagonBoard(3)): BattleDeploy {
  return {
    setup: { id: 'b1', seed: 'store-seed', board, creatures, boulders: [] },
    zones: { heroes: [], enemies: [] },
    biome: 'crypt',
    place: 'Bone Crypt',
    approach: 'W',
    ambush: false,
    names: { hero: 'Merito' },
  };
}
