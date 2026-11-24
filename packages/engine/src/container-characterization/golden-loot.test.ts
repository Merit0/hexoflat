import { locationDropContext, campDropContext } from '../registry/location-drop-context';
import { describe, expect, it } from 'vitest';
import { chestScene, tileOf } from '../chests/chest-test-setup';
import { rollChestLoot } from '../chests/plan-chest-loot';
import { lootTableOf } from '../content/loot-tables.content';
import { lootStreamLabel, rollLoot } from '../loot';
import { generateChestDrop } from '../quests/seeker-chest';
import { deriveStream } from '../utils/random-seeded';
import { hexKey } from '../battle/hex-battle-geom';
import { TARGET } from '../battle/collect-test-setup';
import { graveLootSource } from '../battle/grave-token-source';
import {
  GOLDEN_GRAVE_MAP,
  GOLDEN_SEEDS,
  listOf,
  graveGolden,
  questChestGolden,
  worldChestGolden,
} from './golden-setup';

const WORLD: string[] = [
  '1,3=axex1;3,4=coinsx32 | bag -',
  '5,3=coinsx41;5,4=health-bottlex2 | bag -',
  '3,1=coinsx40;4,1=health-bottlex2;5,2=health-bottlex1 | bag -',
  '16,2=health-bottlex2;15,3=health-bottlex1;14,3=axex1 | bag -',
  '2,2=axex1;3,2=shieldx1;3,3=coinsx17;2,4=health-bottlex2 | bag -',
  '14,2=health-bottlex1;12,1=coinsx17 | bag -',
  '15,2=health-bottlex1;14,2=coinsx29 | bag -',
  '2,14=pickaxex1;3,13=shieldx1;4,14=axex1 | bag -',
  '15,14=coinsx51;15,13=health-bottlex2 | bag -',
  '2,11=health-bottlex1;3,11=axex1;4,12=axex1;3,13=coinsx14 | bag -',
  '15,8=health-bottlex1;14,7=pickaxex1;15,6=coinsx22 | bag -',
  '15,13=health-bottlex2;16,13=health-bottlex1 | bag -',
  '2,2=pickaxex1;3,2=coinsx19 | bag -',
  '6,2=coinsx29;5,3=pickaxex1 | bag -',
  '2,1=shieldx1;3,1=coinsx14 | bag -',
  '1,11=coinsx39 | bag -',
  '15,13=pickaxex1;16,12=shieldx1 | bag -',
  '2,13=coinsx41;4,14=health-bottlex2 | bag -',
  '1,9=pickaxex1;2,9=coinsx48 | bag -',
  '2,12=coinsx61 | bag -',
];

const WARRIOR_GRAVE: string[] = [
  '1,-1=coinsx14;2,-1=health-bottlex1 | bag -',
  'nothing - | bag -',
  '1,-1=coinsx5;2,-1=health-bottlex1 | bag -',
  'nothing - | bag -',
  '1,-1=coinsx12 | bag -',
  'nothing - | bag -',
  '1,-1=coinsx10;2,-1=health-bottlex1 | bag -',
  'nothing - | bag -',
  '1,-1=coinsx12;2,-1=health-bottlex1 | bag -',
  '1,-1=health-bottlex1 | bag -',
  '1,-1=health-bottlex1 | bag -',
  '1,-1=coinsx11;2,-1=health-bottlex1 | bag -',
  '1,-1=coinsx18 | bag -',
  '1,-1=coinsx12;2,-1=health-bottlex1 | bag -',
  '1,-1=health-bottlex1 | bag -',
  '1,-1=coinsx11 | bag -',
  'nothing - | bag -',
  '1,-1=coinsx7 | bag -',
  'nothing - | bag -',
  'nothing - | bag -',
];

const KING_GRAVE: string[] = [
  '1,-1=coinsx37;2,-1=health-bottlex2;2,0=return-scrollx1;1,1=health-bottlex1 | bag -',
  '1,-1=coinsx45;2,-1=health-bottlex1;2,0=swordx1 | bag -',
  '1,-1=coinsx41;2,-1=shieldx1;2,0=return-scrollx1;1,1=health-bottlex2 | bag -',
  '1,-1=coinsx34;2,-1=shieldx1;2,0=swordx1 | bag -',
  '1,-1=coinsx32;2,-1=swordx1;2,0=shieldx1;1,1=shieldx1 | bag -',
  '1,-1=coinsx48;2,-1=swordx1;2,0=health-bottlex1 | bag -',
  '1,-1=coinsx37;2,-1=return-scrollx1;2,0=shieldx1;1,1=health-bottlex2 | bag -',
  '1,-1=coinsx31;2,-1=return-scrollx1;2,0=return-scrollx1 | bag -',
  '1,-1=coinsx41;2,-1=shieldx1;2,0=shieldx1;1,1=health-bottlex1 | bag -',
  '1,-1=coinsx46;2,-1=health-bottlex1;2,0=health-bottlex2 | bag -',
  '1,-1=coinsx50;2,-1=return-scrollx1;2,0=shieldx1 | bag -',
  '1,-1=coinsx30;2,-1=health-bottlex2;2,0=shieldx1;1,1=return-scrollx1 | bag -',
  '1,-1=coinsx39;2,-1=health-bottlex1;2,0=health-bottlex2;1,1=shieldx1 | bag -',
  '1,-1=coinsx32;2,-1=return-scrollx1;2,0=return-scrollx1;1,1=shieldx1 | bag -',
  '1,-1=coinsx46;2,-1=swordx1;2,0=health-bottlex1 | bag -',
  '1,-1=coinsx42;2,-1=shieldx1;2,0=health-bottlex1;1,1=health-bottlex1 | bag -',
  '1,-1=coinsx38;2,-1=swordx1;2,0=health-bottlex2 | bag -',
  '1,-1=coinsx40;2,-1=health-bottlex1;2,0=return-scrollx1 | bag -',
  '1,-1=coinsx46;2,-1=swordx1;2,0=health-bottlex1 | bag -',
  '1,-1=coinsx46;2,-1=return-scrollx1;2,0=return-scrollx1 | bag -',
];

const QUEST_STORED: string[] = [
  'swordx1,shieldx1,health-bottlex1,mana-bottlex1',
  'swordx1,shieldx1,health-bottlex1,mana-bottlex1',
  'swordx1,shieldx1,health-bottlex1,mana-bottlex1',
  'swordx1,shieldx1,health-bottlex1,mana-bottlex1',
  'swordx1,shieldx1,health-bottlex1,mana-bottlex1',
  'swordx1,shieldx1,health-bottlex1,mana-bottlex1',
  'swordx1,shieldx1,health-bottlex1,mana-bottlex1',
  'swordx1,shieldx1,health-bottlex1,mana-bottlex1',
  'swordx1,shieldx1,health-bottlex1,mana-bottlex1',
  'swordx1,shieldx1,health-bottlex1,mana-bottlex1',
  'swordx1,shieldx1,health-bottlex1,mana-bottlex1',
  'swordx1,shieldx1,health-bottlex1,mana-bottlex1',
  'swordx1,shieldx1,health-bottlex1,mana-bottlex1',
  'swordx1,shieldx1,health-bottlex1,mana-bottlex1',
  'swordx1,shieldx1,health-bottlex1,mana-bottlex1',
  'swordx1,shieldx1,health-bottlex1,mana-bottlex1',
  'swordx1,shieldx1,health-bottlex1,mana-bottlex1',
  'swordx1,shieldx1,health-bottlex1,mana-bottlex1',
  'swordx1,shieldx1,health-bottlex1,mana-bottlex1',
  'swordx1,shieldx1,health-bottlex1,mana-bottlex1',
];

const QUEST_PLACED: string[] = [
  '18,5=swordx1;19,5=shieldx1;20,6=health-bottlex1;19,7=mana-bottlex1 | bag -',
  '19,13=swordx1;19,14=shieldx1;18,14=health-bottlex1;17,13=mana-bottlex1 | bag -',
  '13,15=swordx1;14,15=shieldx1;15,16=health-bottlex1;14,17=mana-bottlex1 | bag -',
  '17,13=swordx1;17,14=shieldx1;16,14=health-bottlex1;15,13=mana-bottlex1 | bag -',
  '17,12=swordx1;17,11=shieldx1;18,11=health-bottlex1;19,12=mana-bottlex1 | bag -',
  '17,11=swordx1;18,12=shieldx1;17,13=health-bottlex1;16,13=mana-bottlex1 | bag -',
  '19,14=swordx1;20,14=shieldx1;20,15=health-bottlex1;20,16=mana-bottlex1 | bag -',
  '17,5=swordx1;18,5=shieldx1;19,6=health-bottlex1;18,7=mana-bottlex1 | bag -',
  '15,8=swordx1;14,9=shieldx1;13,9=health-bottlex1;13,8=mana-bottlex1 | bag -',
  '16,16=swordx1;15,16=shieldx1;14,15=health-bottlex1;15,14=mana-bottlex1 | bag -',
  '15,11=swordx1;15,12=shieldx1;14,12=health-bottlex1;13,11=mana-bottlex1 | bag -',
  '17,17=swordx1;18,17=shieldx1;19,18=health-bottlex1;18,19=mana-bottlex1 | bag -',
  '17,8=swordx1;16,9=shieldx1;15,9=health-bottlex1;15,8=mana-bottlex1 | bag -',
  '18,18=swordx1;17,19=shieldx1;16,19=health-bottlex1;16,18=mana-bottlex1 | bag -',
  '15,5=swordx1;16,5=shieldx1;17,6=health-bottlex1;16,7=mana-bottlex1 | bag -',
  '18,14=swordx1;18,13=shieldx1;19,13=health-bottlex1;20,14=mana-bottlex1 | bag -',
  '18,5=swordx1;19,5=shieldx1;20,6=health-bottlex1;19,7=mana-bottlex1 | bag -',
  '17,13=swordx1;18,14=shieldx1;17,15=health-bottlex1;16,15=mana-bottlex1 | bag -',
  '14,9=swordx1;13,9=shieldx1;13,8=health-bottlex1;13,7=mana-bottlex1 | bag -',
  '19,8=swordx1;20,8=shieldx1;20,9=health-bottlex1;20,10=mana-bottlex1 | bag -',
];

describe('CH-P0 golden loot: the exact drop of 20 fixed seeds per space (guards the stream labels)', () => {
  it('world chest: placements and bag for 20 seeds, and the exact label loot:<mapId>:<col>:<row>', () => {
    expect(GOLDEN_SEEDS.map(worldChestGolden)).toEqual(WORLD);
    const scene = chestScene('golden-3');
    expect(`${scene.chest.columnIndex}:${scene.chest.rowIndex}`).toBe('4:2');
    expect(lootStreamLabel(scene.world.mapId, '4:2')).toBe('loot:map-chest:4:2');
    const viaRule = rollChestLoot(tileOf(scene.world, scene.chest), {
      seed: scene.world.worldSeed,
      sourceId: scene.world.mapId,
      dropContext: locationDropContext('cave'),
    });
    const byLabel = rollLoot(
      lootTableOf('cave-chest-loot')!,
      deriveStream(scene.world.worldSeed, 'loot:map-chest:4:2'),
    );
    expect(viaRule).toEqual(byLabel);
    expect(listOf(byLabel)).toBe('coinsx11,health-bottlex2,coinsx29,health-bottlex1');
  });

  it('warrior grave: placements, bag and the empty answer for 20 seeds, and the exact label loot:grave:<mapId>.<battleId>:<q,r> over the token secret', () => {
    const actual = GOLDEN_SEEDS.map((seed) => graveGolden(seed, 'warrior'));
    expect(actual).toEqual(WARRIOR_GRAVE);
    const source = graveLootSource(
      { id: 'b1', tokenSecret: { seed: 'golden-3', mapId: GOLDEN_GRAVE_MAP } },
      hexKey(TARGET),
    );
    expect(source.seed).toBe('golden-3');
    expect(lootStreamLabel(source.sourceId, source.targetKey)).toBe('loot:grave:golden-map.b1:1,0');
    const byLabel = rollLoot(
      lootTableOf('skeleton-warrior-loot')!,
      deriveStream('golden-3', 'loot:grave:golden-map.b1:1,0'),
    );
    expect(listOf(byLabel)).toBe('coinsx5,health-bottlex1');
  });

  it('king grave: placements and bag for 20 seeds', () => {
    expect(GOLDEN_SEEDS.map((seed) => graveGolden(seed, 'king'))).toEqual(KING_GRAVE);
  });

  it('quest chest: the stored drop list and the placements for 20 seeds, and the exact label loot:<seed>:<col>:<row> (the seed is the sourceId)', () => {
    const rolled = GOLDEN_SEEDS.map(questChestGolden);
    expect(rolled.map((entry) => entry.stored)).toEqual(QUEST_STORED);
    expect(rolled.map((entry) => entry.text)).toEqual(QUEST_PLACED);
    expect(lootStreamLabel('golden-3', '14:16')).toBe('loot:golden-3:14:16');
    const byLabel = rollLoot(
      lootTableOf('seeker-1-chest-loot')!,
      deriveStream('golden-3', 'loot:golden-3:14:16'),
    );
    expect(listOf(byLabel)).toBe(QUEST_STORED[2]);
    expect(
      listOf(
        generateChestDrop({
          dropContext: campDropContext(),
          seed: 'golden-3',
          chestHex: { columnIndex: 14, rowIndex: 16 },
          tableId: 'seeker-1-chest-loot',
        }),
      ),
    ).toBe(QUEST_STORED[2]);
  });
});
