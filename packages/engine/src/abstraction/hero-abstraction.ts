import type { EDimension } from '../dimensions/dimensions';
import { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';

export interface IHero {
  id: string;
  name: string;
  currentHealth: number;
  maxHealth: number;
  attack: number;
  defense: number;
  kills: number;
  currentEnergy: number;
  maxEnergy: number;
  imgPath: string;
  heroLocation: IHexCoordinates;
  heroSteps: number;
  readonly origin: EDimension;
}
