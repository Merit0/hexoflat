export type HexObjectKind = "tree" | "coin" | "rock";

export interface HexObjectTraits {
    collectable?: boolean;
    cuttable?: boolean;
    pickupable?: boolean;
    mineable?: boolean;
}

export interface HexObjectModel {
    id: string;
    kind: HexObjectKind;
    isInteractable: boolean;
    traits: HexObjectTraits;
    spritePath?: string;
    description?: string;
}