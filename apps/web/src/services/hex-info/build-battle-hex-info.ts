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
import type { HexInfoTranslate, HexInfoView } from './build-hex-info';

export interface BattleHexInfoScene {
  board: Record<string, BattleTerrain>;
  boulders: Boulder[];
  creatures: BattleCreature[];
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
    title: label(t, def.title, te),
    kind: t('itemTooltip.group.construction'),
    subtitle: null,
    description: saw ? t('hexInfo.hints.saw') : label(t, def.tableRule, te),
    accent: OBJECT_ACCENT,
    icon: OBJECT_ICON[id] ?? 'stack',
    rarity: null,
    hearts: null,
    supply: null,
    headline: null,
    locked: false,
    broken: false,
    effect: saw ? { label: t('hexInfo.effects.sawHurts') } : null,
    tags: [],
    stats: [],
    actions: [],
  };
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
  if (scene.boulders.some((boulder) => hexKey(boulder.pos) === key)) {
    return objectView('boulder', t, te);
  }
  const terrain = scene.board[key];
  if (!terrain || terrain === 'floor') return null;
  return objectView(terrain, t, te);
}
