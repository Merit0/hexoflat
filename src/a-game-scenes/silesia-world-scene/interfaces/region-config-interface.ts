export type TerrainType =
    'no-terrain'
    | 'forest'
    | 'deep-forest'
    | 'deep-sea'
    | 'sea'
    | 'mountain'
    | 'desert'
    | 'deep-desert'
    | 'swamp'
    | 'evil-portal'
    | 'field'
    | 'monster-prison'
    | 'camp';

export interface IRegionConfig {
    key: string;
    terrain: TerrainType;
    name?: string;
    coordinates: [number, number][];
    images?: string[];
    backgroundImgPath?: string;
    requiredMyriads?: number;
}