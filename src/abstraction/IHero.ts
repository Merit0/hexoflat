import {type ICoordinates, TileModel} from "@/a-game-scenes/homeland-scene/models/tile-model";


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
  currentTile: TileModel;
  heroLocation: ICoordinates;
  heroSteps: number;
  // equipment: EquipmentModel;
  // heroDices: DiceModel[]
  // experienceCollector(): void;
  // getHeroDices(): DiceModel[];
}
