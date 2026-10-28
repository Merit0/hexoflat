import { z } from 'zod';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { BattleCreature, BattleHex, BattleItem } from './battle-state';

const i18nKey = z.string().regex(/^content\.battle\.[a-z0-9-]+\.[a-zA-Z]+$/);

export const battleItemDefSchema = z.object({
  id: z.string().min(1),
  power: z.number().int().positive().optional(),
  range: z.object({ min: z.number().int().min(2), max: z.number().int().min(2) }).optional(),
  shieldCapacity: z.number().int().positive().optional(),
  heal: z.number().int().positive().optional(),
  title: i18nKey,
  tableRule: i18nKey,
});
export type BattleItemDef = z.infer<typeof battleItemDefSchema>;

export const BATTLE_BEHAVIOURS = ['hero', 'warrior', 'king', 'archer'] as const;
export type BattleBehaviour = (typeof BATTLE_BEHAVIOURS)[number];

export const battleCreatureDefSchema = z.object({
  id: z.string().min(1),
  behaviour: z.enum(BATTLE_BEHAVIOURS),
  hp: z.number().int().positive(),
  weight: z.number().int().min(0),
  force: z.number().int().min(0),
  hands: z.object({ right: z.string().nullable(), left: z.string().nullable() }),
  title: i18nKey,
  tableRule: i18nKey,
});
export type BattleCreatureDef = z.infer<typeof battleCreatureDefSchema>;

export const battleObjectDefSchema = z.object({
  id: z.string().min(1),
  title: i18nKey,
  tableRule: i18nKey,
});
export type BattleObjectDef = z.infer<typeof battleObjectDefSchema>;

function texts(id: string) {
  return { title: `content.battle.${id}.title`, tableRule: `content.battle.${id}.tableRule` };
}

function byId<T extends { id: string }>(schema: z.ZodType<T>, defs: T[]): Record<string, T> {
  return Object.fromEntries(defs.map((def) => [def.id, schema.parse(def)]));
}

export const BATTLE_ITEMS: Record<string, BattleItemDef> = byId(battleItemDefSchema, [
  { id: 'sword', power: 2, ...texts('sword') },
  { id: 'dagger', power: 1, ...texts('dagger') },
  { id: 'wooden-shield', shieldCapacity: 2, ...texts('wooden-shield') },
  { id: 'health-potion', heal: 2, ...texts('health-potion') },
  { id: 'bone-blade', power: 1, ...texts('bone-blade') },
  { id: 'bone-buckler', shieldCapacity: 1, ...texts('bone-buckler') },
  { id: 'king-cleaver', power: 1, ...texts('king-cleaver') },
  { id: 'king-shield', shieldCapacity: 2, ...texts('king-shield') },
  { id: 'bone-bow', power: 1, range: { min: 2, max: 3 }, ...texts('bone-bow') },
]);

export const BATTLE_CREATURES: Record<string, BattleCreatureDef> = byId(battleCreatureDefSchema, [
  {
    id: 'hero',
    behaviour: 'hero',
    hp: 6,
    weight: 1,
    force: 1,
    hands: { right: 'sword', left: 'wooden-shield' },
    ...texts('hero'),
  },
  {
    id: 'skeleton-warrior',
    behaviour: 'warrior',
    hp: 3,
    weight: 1,
    force: 1,
    hands: { right: 'bone-blade', left: 'bone-buckler' },
    ...texts('skeleton-warrior'),
  },
  {
    id: 'skeleton-king',
    behaviour: 'king',
    hp: 8,
    weight: 3,
    force: 2,
    hands: { right: 'king-cleaver', left: 'king-shield' },
    ...texts('skeleton-king'),
  },
  {
    id: 'skeleton-archer',
    behaviour: 'archer',
    hp: 2,
    weight: 1,
    force: 1,
    hands: { right: 'bone-bow', left: null },
    ...texts('skeleton-archer'),
  },
]);

export const BATTLE_OBJECTS: Record<string, BattleObjectDef> = byId(
  battleObjectDefSchema,
  ['wall', 'rubble', 'ledge', 'oil', 'saw', 'boulder'].map((id) => ({ id, ...texts(id) })),
);

const BATTLE_KIND_BY_HEXOBJECT: Record<string, string> = {
  [HEXOBJECT_KEYS.SKELETOR]: 'skeleton-warrior',
};

const BATTLE_ITEM_BY_HEXOBJECT: Record<string, string> = {
  [HEXOBJECT_KEYS.SWORD]: 'sword',
  [HEXOBJECT_KEYS.SHIELD]: 'wooden-shield',
};

export function battleKindOfHexobject(hexobjectKey: string): string | null {
  return BATTLE_KIND_BY_HEXOBJECT[hexobjectKey] ?? null;
}

export function battleItemOfHexobject(hexobjectKey: string): string | null {
  return BATTLE_ITEM_BY_HEXOBJECT[hexobjectKey] ?? null;
}

export function battleItem(id: string): BattleItem {
  const def = BATTLE_ITEMS[id];
  if (!def) throw new Error(`Unknown battle item: ${id}`);
  const item: BattleItem = { key: id };
  if (def.power) item.power = def.power;
  if (def.range) item.range = { ...def.range };
  if (def.shieldCapacity) item.shieldCapacity = def.shieldCapacity;
  if (def.heal) item.heal = def.heal;
  return item;
}

export function behaviourOf(kind: string): BattleBehaviour {
  return BATTLE_CREATURES[kind]?.behaviour ?? 'warrior';
}

export function enemyCreature(kind: string, id: string, pos: BattleHex): BattleCreature {
  const def = BATTLE_CREATURES[kind];
  if (!def || def.behaviour === 'hero') throw new Error(`Unknown enemy kind: ${kind}`);
  return {
    id,
    side: 'enemies',
    kind,
    pos: { ...pos },
    hp: def.hp,
    maxHp: def.hp,
    weight: def.weight,
    force: def.force,
    hands: {
      right: def.hands.right ? battleItem(def.hands.right) : null,
      left: def.hands.left ? battleItem(def.hands.left) : null,
    },
    bag: [],
  };
}
