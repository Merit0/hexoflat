import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';

export interface HeroState {
  id: string;
  controlledBy: string | null;
  coordinates: IHexCoordinates;
  heroSteps: number;
}
