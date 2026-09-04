import HexMapModel from '../models/hex-map-model';
import {
  campingMapConfig,
  homelandMapConfig,
  skeletorsKingdomMapConfig,
} from './map-tiles-schema-provider';
import { Complexity } from '../../enums/complexity';
import { WorldGenerator } from '../../generators/world-generator';

export class HexMapProvider {
  static getHomeLand(): HexMapModel {
    return new WorldGenerator({
      worldName: 'Silesia',
      worldWidth: 17,
      worldHeight: 15,
      worldComplexity: Complexity.EASY,
      config: homelandMapConfig,
      safeZoneRadius: 1,
      fogMode: 'FOG',
    }).generate();
  }

  static getCamping(): HexMapModel {
    return new WorldGenerator({
      worldName: 'Camping',
      worldWidth: 10,
      worldHeight: 6,
      worldComplexity: Complexity.EASY,
      config: campingMapConfig,
      safeZoneRadius: 1,
      fogMode: 'ALL_REVEALED',
    }).generate();
  }

  static getSkeletorsKingdom(): HexMapModel {
    return new WorldGenerator({
      worldName: 'Skeletors Kingdom',
      worldWidth: 16,
      worldHeight: 5,
      worldComplexity: Complexity.HARD,
      config: skeletorsKingdomMapConfig,
      safeZoneRadius: 1,
      fogMode: 'FOG',
    }).generate();
  }
}
