import { Complexity } from '../enums/complexity';
import { IHexMapPlacement } from './hex-map-placement';
export type TFogMode = 'FOG' | 'ALL_REVEALED';

export interface IWorldGenerator {
  worldName: string;
  worldWidth: number;
  worldHeight: number;
  worldComplexity: Complexity;
  config: IHexMapPlacement[];
  safeZoneRadius?: number;
  fogMode?: TFogMode;
}
