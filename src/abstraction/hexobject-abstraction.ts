export type THexobjectGroup = EHexobjectGroup;
export type THexCollision = EHexCollision;

interface IDurable {
    durability: number;
    durabilityMax: number;
}

export interface IBaseHexobject {
    id: string;
    hexobjectKey: string;
    groupType: THexobjectGroup;
    isInteractable: boolean;
    spritePath?: string;
    description?: string;
    collision: THexCollision;
}


export interface IResource {
    isAvailable: boolean;
    regrowMs?: number | null;
    regrowAt?: number | null;
    amount?: number;
    traits: {
        collectable?: boolean;
        cuttable?: boolean;
        mineable?: boolean;
        pickupable?: boolean;
    };
}

export interface ICreature {
    hp: number;
    hpMax: number;
    faction?: "neutral" | "enemy" | "friendly";
}

export interface ITool extends IDurable {
    capabilities: {
        canCut?: boolean;
        canMine?: boolean;
        canPickup?: boolean;
    };
}

export interface IConstruction {
    integrity: number;
}

export interface IWeapon {
    damageMin: number;
    damageMax: number;
}

export interface IEquipment extends IDurable {}

export type THexobjectPrototype =
    | (Omit<IBaseHexobject, "id"> & { groupType: EHexobjectGroup.RESOURCE; resource: IResource })
    | (Omit<IBaseHexobject, "id"> & { groupType: EHexobjectGroup.CREATURE; creature: ICreature })
    | (Omit<IBaseHexobject, "id"> & { groupType: EHexobjectGroup.TOOL; tool: ITool })
    | (Omit<IBaseHexobject, "id"> & { groupType: EHexobjectGroup.CONSTRUCTION; construction: IConstruction })
    | (Omit<IBaseHexobject, "id"> & { groupType: EHexobjectGroup.WEAPON; equipment: IEquipment, weapon: IWeapon });

export type THexobject =
    | (IBaseHexobject & { groupType: EHexobjectGroup.RESOURCE; resource: IResource })
    | (IBaseHexobject & { groupType: EHexobjectGroup.CREATURE; creature: ICreature })
    | (IBaseHexobject & { groupType: EHexobjectGroup.TOOL; tool: ITool })
    | (IBaseHexobject & { groupType: EHexobjectGroup.CONSTRUCTION; construction: IConstruction })
    | (IBaseHexobject & { groupType: EHexobjectGroup.WEAPON; equipment: IEquipment, weapon: IWeapon });


export enum EHexobjectGroup {
    RESOURCE = 'resource',
    CREATURE = 'creature',
    TOOL = 'tool',
    WEAPON = 'weapon',
    CONSTRUCTION = 'construction',
}

export enum EHexCollision {
    NONE = "none",
    SOLID = "solid",
    TRIGGER = "trigger",
    OVERLAY = "overlay",
}
