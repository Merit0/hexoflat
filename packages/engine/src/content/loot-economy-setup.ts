import { locationTokenOrigin } from '../registry/location-token-origin';
import { DEFAULT_TOKEN_ORIGIN } from '../tokens/token-origin';
import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { applyBattleCommand } from '../battle/apply-battle';
import { isFreeHex } from '../battle/battle-board';
import { BATTLE_RULES } from '../battle/battle-content';
import type { BattleState } from '../battle/battle-state';
import { playOutSquad } from '../battle/collect-playout-setup';
import { graveLootSource, graveTokenSource } from '../battle/grave-token-source';
import { hexKey, hexNeighbours } from '../battle/hex-battle-geom';
import { isTerrainPassable } from '../boards/terrain';
import type { ChestWorld } from '../chests/open-chest';
import { rollChestLoot } from '../chests/plan-chest-loot';
import { worldChestSpace } from '../chests/world-container-space';
import { createContainer, openInSpace } from '../containers';
import { EHexActionType } from '../enums/hex-action-type';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { emptyInventoryState } from '../inventory/inventory-state';
import { lootStreamLabel, rollLoot, type LootDrop } from '../loot';
import type HexMapModel from '../map/models/hex-map-model';
import type { HexTileModel } from '../map/models/hex-tile-model';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { MapRegistry } from '../registry/world-map-registry';
import { sellUnitPrice } from '../trade/trader-view';
import { coordinateKey, getHexNeighbors, offsetToAxial } from '../utils/hex-utils';
import { deriveStream } from '../utils/random-seeded';
import { getPrototype } from './content-accessors';
import { lootTableOf, SKELETON_KING_TABLE_ID } from './loot-tables.content';
import { TRADERS } from './traders.content';

const ON = { ...BATTLE_RULES, graveLootEnabled: true };
const COURT = ['skeleton-king', 'skeleton-warrior', 'skeleton-warrior'];
const PACK = ['skeleton-warrior', 'skeleton-warrior'];
const LONE = ['skeleton-warrior'];

export interface CavePool {
  map: HexMapModel;
  chest: HexTileModel;
  entry: HexTileModel['coordinates'];
}

export interface EconomyPools {
  caves: CavePool[];
  court: BattleState[];
  pack: BattleState[];
  lone: BattleState[];
}

export interface RunResult {
  coins: number;
  sellValue: number;
  ordinaryGraves: number;
  emptyOrdinaryGraves: number;
  rolledDrops: number;
  lostDrops: number;
}

function victories(members: string[], label: string, count: number): BattleState[] {
  const found: BattleState[] = [];
  for (let attempt = 0; found.length < count && attempt < count * 6; attempt += 1) {
    const battle = playOutSquad(members, `${label}-${attempt}`, `${label}-field-${attempt}`);
    if (battle.outcome === 'victory' && battle.collect) found.push(battle);
  }
  return found;
}

function cavePool(seed: string): CavePool | null {
  const { map } = MapRegistry.get('cave').create({ seed });
  for (const tile of map.tiles) {
    const object = tile.hexobject;
    if (object?.groupType === EHexobjectGroup.CREATURE && object.creature.squad) {
      tile.hexobject = null;
    }
  }
  const byKey = new Map(map.tiles.map((tile) => [coordinateKey(tile.coordinates), tile]));
  const chest = map.tiles.find((tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.CHEST);
  if (!chest) return null;
  const entry = getHexNeighbors(chest.coordinates).find((coord) => {
    const tile = byKey.get(coordinateKey(coord));
    return !!tile && isTerrainPassable(tile.terrain) && !tile.hexobject;
  });
  return entry ? { map, chest, entry } : null;
}

export function buildPools(sizes = { caves: 120, court: 80, pack: 80, lone: 60 }): EconomyPools {
  const caves: CavePool[] = [];
  for (let i = 0; caves.length < sizes.caves && i < sizes.caves * 3; i += 1) {
    const pool = cavePool(`economy-cave-${i}`);
    if (pool) caves.push(pool);
  }
  return {
    caves,
    court: victories(COURT, 'economy-court', sizes.court),
    pack: victories(PACK, 'economy-pack', sizes.pack),
    lone: victories(LONE, 'economy-lone', sizes.lone),
  };
}

function mergedCount(lists: readonly (readonly LootDrop[])[]): number {
  const drops = lists.flat();
  const coins = drops.some((drop) => drop.itemKey === HEXOBJECT_KEYS.COINS) ? 1 : 0;
  return drops.filter((drop) => drop.itemKey !== HEXOBJECT_KEYS.COINS).length + coins;
}

function worth(itemKey: string, amount: number): { coins: number; sell: number } {
  if (itemKey === HEXOBJECT_KEYS.COINS) return { coins: amount, sell: amount };
  const unit = sellUnitPrice(TRADERS.ilva, itemKey as never) ?? 0;
  return { coins: 0, sell: unit * amount };
}

function emptyResult(): RunResult {
  return {
    coins: 0,
    sellValue: 0,
    ordinaryGraves: 0,
    emptyOrdinaryGraves: 0,
    rolledDrops: 0,
    lostDrops: 0,
  };
}

function take(
  result: RunResult,
  items: readonly { itemKey: string; amount: number }[],
  rolled: number,
): void {
  for (const { itemKey, amount } of items) {
    const gained = worth(itemKey, amount);
    result.coins += gained.coins;
    result.sellValue += gained.sell;
  }
  result.rolledDrops += rolled;
  result.lostDrops += Math.max(0, rolled - items.length);
}

function lootChest(pool: CavePool, runSeed: string, result: RunResult): void {
  const context = {
    seed: `${runSeed}:world`,
    sourceId: `cave-${runSeed}`,
    origin: locationTokenOrigin('cave'),
  };
  const rolled = mergedCount([rollChestLoot(pool.chest, context)]);
  const original = pool.chest.hexobject!;
  const ring = getHexNeighbors(pool.chest.coordinates).map((coords) => tileAt(pool.map, coords));
  const ringBefore = ring.map((tile) => tile?.hexobject ?? null);
  const key = coordinateKey(pool.chest.coordinates);
  pool.chest.hexobject = {
    ...original,
    container: createContainer({
      id: key,
      kind: 'chest',
      at: offsetToAxial(pool.chest.coordinates),
      tables: [lootTableOf(chestTableId(original.hexobjectKey))],
      seed: context.seed,
      sourceId: context.sourceId,
      targetKey: key,
      origin: context.origin,
    }),
  };
  const hero = 'economy-hero';
  const world: ChestWorld = {
    map: pool.map,
    heroes: { [hero]: { coordinates: { ...pool.entry } } } as unknown as ChestWorld['heroes'],
    loot: context,
  };
  const opened = openInSpace(
    worldChestSpace(EHexActionType.OPEN),
    world,
    hero,
    pool.chest.coordinates,
    { current: emptyInventoryState(hero), events: [] },
  );
  const event = opened.events.find((candidate) => candidate.type === 'CONTAINER_OPENED');
  const payload = event?.payload as GravePayload | undefined;
  take(result, payload ? [...payload.placed, ...payload.toBag] : [], rolled);
  pool.chest.hexobject = original;
  ring.forEach((tile, index) => {
    if (tile) tile.hexobject = ringBefore[index];
  });
}

function tileAt(map: HexMapModel, at: IHexCoordinates): HexTileModel | undefined {
  return map.tiles.find((tile) => coordinateKey(tile.coordinates) === coordinateKey(at));
}

function chestTableId(hexobjectKey: string): string | undefined {
  const proto = getPrototype(hexobjectKey as never);
  return proto.groupType === EHexobjectGroup.CONSTRUCTION
    ? proto.construction.lootTableId
    : undefined;
}

const ECONOMY_MAP_ID = 'economy-sim';

interface GravePayload {
  placed: { itemKey: string; amount: number }[];
  toBag: { itemKey: string; amount: number }[];
}

function lootGraves(source: BattleState, runSeed: string, label: string, result: RunResult): void {
  let battle: BattleState = {
    ...structuredClone(source),
    tokenSecret: { seed: `${runSeed}:${label}`, mapId: ECONOMY_MAP_ID },
  };
  for (const grave of battle.collect!.graves) {
    grave.container = createContainer({
      id: hexKey(grave.hex),
      kind: 'grave',
      at: grave.hex,
      tables: grave.tables.map((id) => lootTableOf(id)),
      ...graveLootSource(battle, hexKey(grave.hex)),
      origin: battle.tokenOrigin ?? DEFAULT_TOKEN_ORIGIN,
      tokenSource: graveTokenSource(battle),
    });
  }
  for (const { hex, tables } of structuredClone(battle.collect!.graves)) {
    const grave = { hex, tables };
    const stream = graveLootSource(battle, hexKey(grave.hex));
    const rng = deriveStream(stream.seed, lootStreamLabel(stream.sourceId, stream.targetKey));
    const lists = grave.tables.map((id) => rollLoot(lootTableOf(id)!, rng));
    const rolled = mergedCount(lists);
    const ordinary = !grave.tables.includes(SKELETON_KING_TABLE_ID);
    if (ordinary) {
      result.ordinaryGraves += 1;
      if (rolled === 0) result.emptyOrdinaryGraves += 1;
    }
    const player = battle.creatures.find((c) => c.side === 'heroes')!;
    const entry = hexNeighbours(grave.hex).find((hex) => isFreeHex(battle, hex, player.id));
    if (!entry) {
      take(result, [], rolled);
      continue;
    }
    player.pos = { ...entry };
    const answer = applyBattleCommand(
      battle,
      {
        type: 'BATTLE',
        payload: {
          kind: 'hero',
          heroId: player.id,
          atMs: 0,
          action: { kind: 'loot-grave', hex: grave.hex },
        },
      },
      ON,
      { inventory: { current: emptyInventoryState(player.id), events: [] } },
    );
    const looted = answer.events.find((event) => event.type === 'CONTAINER_OPENED');
    if (!looted) {
      take(result, [], rolled);
      continue;
    }
    const payload = looted.payload as GravePayload;
    take(result, [...payload.placed, ...payload.toBag], rolled);
    battle = answer.battle!;
  }
}

export function simulateRun(pools: EconomyPools, index: number): RunResult {
  const runSeed = `economy-run-${index}`;
  const pick = deriveStream(runSeed, 'layout');
  const of = <T>(list: T[]): T => list[Math.floor(pick() * list.length)];
  const result = emptyResult();
  lootChest(of(pools.caves), runSeed, result);
  lootGraves(of(pools.court), runSeed, 'court', result);
  lootGraves(of(pools.pack), runSeed, 'pack', result);
  lootGraves(of(pools.lone), runSeed, 'lone', result);
  return result;
}

export interface Summary {
  mean: number;
  median: number;
  p5: number;
  p95: number;
}

export function summarise(values: number[]): Summary {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (share: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))];
  return {
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    median: at(0.5),
    p5: at(0.05),
    p95: at(0.95),
  };
}
