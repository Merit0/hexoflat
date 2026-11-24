import type { ItemToken } from '@hexoflat/engine/tokens/token-schema';
import { itemDimensionOf } from '@hexoflat/engine/inventory/item-dimension';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { BATTLE_OBJECTS } from '@hexoflat/engine/battle/battle-catalogue';
import { isAlive } from '@hexoflat/engine/battle/battle-board';
import { hexKey } from '@hexoflat/engine/battle/hex-battle-geom';
import type {
  BattleCreature,
  BattleHex,
  BattleTerrain,
  Boulder,
} from '@hexoflat/engine/battle/battle-state';
import type { TIconName } from '@/components/gui/icons/item-icons';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { buildHexInfo, type HexInfoTranslate, type HexInfoView } from './build-hex-info';

export interface BattleHexInfoScene {
  board: Record<string, BattleTerrain>;
  boulders: Boulder[];
  creatures: BattleCreature[];
  collect?: {
    graves: { hex: BattleHex; examined: boolean }[];
    items: { hex: BattleHex; itemKey: string; amount: number; token?: ItemToken }[];
  } | null;
}

const OBJECT_ACCENT = '#d1a35f';

const OBJECT_ICON: Record<string, TIconName> = {
  wall: 'tower',
  saw: 'tower',
  rubble: 'rock',
  boulder: 'rock',
  ledge: 'better',
  oil: 'drop',
};

function label(t: HexInfoTranslate, key: string, te: (key: string) => boolean): string {
  return te(key) ? t(key) : key;
}

function objectView(
  id: string,
  t: HexInfoTranslate,
  te: (key: string) => boolean,
): HexInfoView | null {
  const def = BATTLE_OBJECTS[id];
  if (!def) return null;
  const saw = id === 'saw';
  return {
    variant: saw ? 'construction' : 'item',
    key: `battle-object-${id}`,
    dimension: def.dimension,
    title: label(t, def.title, te),
    kind: t('itemTooltip.group.construction'),
    subtitle: null,
    description: saw ? t('hexInfo.hints.saw') : label(t, def.tableRule, te),
    accent: OBJECT_ACCENT,
    icon: OBJECT_ICON[id] ?? 'stack',
    tokenType: null,
    hearts: null,
    supply: null,
    headline: null,
    locked: false,
    broken: false,
    empty: false,
    note: null,
    effect: saw ? { label: t('hexInfo.effects.sawHurts') } : null,
    tags: [],
    stats: [],
    actions: [],
  };
}

function graveView(examined: boolean, t: HexInfoTranslate): HexInfoView {
  return {
    variant: 'construction',
    key: 'battle-grave',
    dimension: itemDimensionOf({ key: HEXOBJECT_KEYS.GRAVE }),
    title: t('hexInfo.grave.title'),
    kind: t('itemTooltip.group.construction'),
    subtitle: null,
    description: t('hexInfo.grave.description'),
    accent: OBJECT_ACCENT,
    icon: 'skull',
    tokenType: null,
    hearts: null,
    supply: null,
    headline: null,
    locked: false,
    broken: false,
    empty: examined,
    note: examined ? null : t('hexInfo.hints.graveLoot'),
    effect: null,
    tags: [],
    stats: [],
    actions: [],
  };
}

function groundItemView(
  item: { hex: BattleHex; itemKey: string; amount: number; token?: ItemToken },
  t: HexInfoTranslate,
  te: (key: string) => boolean,
): HexInfoView {
  const obj = HexObjectFactory.create(
    item.itemKey as THexobjectKey,
    { columnIndex: 0, rowIndex: 0 },
    { quantity: item.amount, ...(item.token ? { token: item.token } : {}) },
  );
  return buildHexInfo(obj, t(`itemTooltip.group.${obj.groupType}`), t, te);
}

export function buildBattleHexInfo(
  hex: BattleHex,
  scene: BattleHexInfoScene,
  t: HexInfoTranslate,
  te: (key: string) => boolean,
): HexInfoView | null {
  const key = hexKey(hex);
  if (scene.creatures.some((creature) => isAlive(creature) && hexKey(creature.pos) === key)) {
    return null;
  }
  const grave = scene.collect?.graves.find((candidate) => hexKey(candidate.hex) === key);
  if (grave) return graveView(grave.examined, t);
  const item = scene.collect?.items.find((candidate) => hexKey(candidate.hex) === key);
  if (item) return groundItemView(item, t, te);
  if (scene.boulders.some((boulder) => hexKey(boulder.pos) === key)) {
    return objectView('boulder', t, te);
  }
  const terrain = scene.board[key];
  if (!terrain || terrain === 'floor') return null;
  return objectView(terrain, t, te);
}
