import MapModel from '../models/map-model';
import {MapBuilder} from '@/a-game-scenes/homeland-scene/builders/map-builder';
import {Complexity} from '@/enums/complexity';

export class MapProvider {
    static getSilesiaMap(): MapModel {
        return new MapBuilder()
            .name("Silesia")
            // .mapLocations(MapLocationProvider.getSilesiaLocations())
            .complexity(Complexity.EASY)
            .isLocked(false)
            .build();
    }

    static getUndergroundMap(): MapModel {
        return new MapBuilder()
            .name("Underground")
            // .mapLocations(MapLocationProvider.getDungeonLocations())
            .complexity(Complexity.HARD)
            .isLocked(false)
            .build();
    }
}