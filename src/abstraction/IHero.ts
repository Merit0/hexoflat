import {type ICoordinates, TileModel} from "../a-game-scenes/silesia-world-scene/models/tile-model.ts";
import type {DiceModel} from "../models/DiceModel.ts";
import type {EquipmentModel} from "../models/equipment-model.ts";


export interface IHero {
  name: string;
  currentHealth: number;
  maxHealth: number;
  attack: number;
  defense: number;
  coins: number;
  stats: boolean;
  kills: number;
  currentEnergy: number;
  maxEnergy: number;
  id: number;
  imgPath: string;
  available: boolean;
  equipment: EquipmentModel;
  currentTile: TileModel;
  heroLocation: ICoordinates;
  heroSteps: number;
  heroDices: DiceModel[]
  experienceCollector(): void;
  getHeroDices(): DiceModel[];
}
