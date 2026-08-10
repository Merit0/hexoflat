import { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';

export interface IHero {
  id: string;
  name: string;
  currentHealth: number;
  maxHealth: number;
  attack: number;
  defense: number;
  coins: number;
  kills: number;
  currentEnergy: number;
  maxEnergy: number;
  imgPath: string;
  heroLocation: IHexCoordinates;
  heroSteps: number;
}
