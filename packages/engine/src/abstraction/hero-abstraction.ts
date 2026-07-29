import { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';

export interface IHero {
  id: number;
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
  // equipment: EquipmentModel;
  // heroDices: DiceModel[]
  // experienceCollector(): void;
  // getHeroDices(): DiceModel[];
}
