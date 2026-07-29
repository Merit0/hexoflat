import { THexobjectKey } from '../registry/hexobjects-registry';

export type THexobjectGroup = EHexobjectGroup;
export type THexCollision = EHexCollision;

export const EQUIP_SLOTS = [
  'weapon',
  'shield',
  'armor',
  'gloves',
  'helm',
  'boots',
  'ring',
  'amulet',
] as const;

export type TEquipSlot = (typeof EQUIP_SLOTS)[number];

export interface ITraitable<TTraits> {
  traits: TTraits;
}

export interface ILootTraits {
  stackable?: boolean;
  maxStack?: number;
  stackKey: THexobjectKey;
  weightKG: number;
}

export interface IResourceTraits {
  cuttable?: boolean;
  mineable?: boolean;
  pickable?: boolean;
}

interface IDurable {
  durability: number;
  durabilityMax: number;
}

export interface IBaseHexobject {
  id: string;
  hexobjectKey: THexobjectKey;
  groupType: THexobjectGroup;
  isInteractable: boolean;
  spritePath?: string;
  description?: string;
  collision: THexCollision;
}

export interface IResource extends ITraitable<IResourceTraits> {
  isAvailable: boolean;
  regrowMs?: number | null;
  regrowAt?: number | null;
  amount?: number;
  maxAmount: number;
  requiredToolKey?: THexobjectKey | null;
  traits: IResourceTraits;
}

export interface ILoot extends ITraitable<ILootTraits> {
  name: string;
  amount?: number;
  traits: ILootTraits;
}

export interface ICreature {
  name: string;
  hp: number;
  hpMax: number;
  attack: number;
  faction?: 'neutral' | 'enemy' | 'friendly';
  visionRange?: number;
}

export interface ITool extends IDurable {
  attackMultiplier?: number;
  defense?: number;
  capabilities: {
    canCut?: boolean;
    canMine?: boolean;
    canPickup?: boolean;
    canEnter?: boolean;
    canUse?: boolean;
    canAttack?: boolean;
    canBlock?: boolean;
  };

  traits: {
    weightKG: number;
  };
}

export interface IConstruction {
  integrity: number;
  isLocked?: boolean;
}

export interface IWeapon {
  damageMin: number;
  damageMax: number;
  attackMultiplier?: number;
}

export interface IEquipment extends IDurable {
  defense?: number;
  capabilities?: {
    canAttack?: boolean;
    canBlock?: boolean;
  };
  traits?: {
    weightKG?: number;
  };
}

export type THexobjectPrototype =
  | (Omit<IBaseHexobject, 'id'> & { groupType: EHexobjectGroup.RESOURCE; resource: IResource })
  | (Omit<IBaseHexobject, 'id'> & { groupType: EHexobjectGroup.LOOT; loot: ILoot })
  | (Omit<IBaseHexobject, 'id'> & { groupType: EHexobjectGroup.CREATURE; creature: ICreature })
  | (Omit<IBaseHexobject, 'id'> & { groupType: EHexobjectGroup.TOOL; tool: ITool })
  | (Omit<IBaseHexobject, 'id'> & {
      groupType: EHexobjectGroup.CONSTRUCTION;
      construction: IConstruction;
    })
  | (Omit<IBaseHexobject, 'id'> & {
      groupType: EHexobjectGroup.EQUIPMENT;
      equipment: IEquipment;
      weapon?: IWeapon;
    });

export type THexobject =
  | (IBaseHexobject & { groupType: EHexobjectGroup.RESOURCE; resource: IResource })
  | (IBaseHexobject & { groupType: EHexobjectGroup.LOOT; loot: ILoot })
  | (IBaseHexobject & { groupType: EHexobjectGroup.CREATURE; creature: ICreature })
  | (IBaseHexobject & { groupType: EHexobjectGroup.TOOL; tool: ITool })
  | (IBaseHexobject & { groupType: EHexobjectGroup.CONSTRUCTION; construction: IConstruction })
  | (IBaseHexobject & {
      groupType: EHexobjectGroup.EQUIPMENT;
      equipment: IEquipment;
      weapon?: IWeapon;
    });

export enum EHexobjectGroup {
  RESOURCE = 'resource',
  CREATURE = 'creature',
  TOOL = 'tool',
  CONSTRUCTION = 'construction',
  LOOT = 'loot',
  EQUIPMENT = 'equipment',
}

export enum EHexCollision {
  NONE = 'none',
  SOLID = 'solid',
  TRIGGER = 'trigger',
  OVERLAY = 'overlay',
}
