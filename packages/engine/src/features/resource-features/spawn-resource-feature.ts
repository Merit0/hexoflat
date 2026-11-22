import { assertBoardPlacement, type BoardPlacementScope } from '../../boards/board-dimension';
import HexMapModel from '../../map/models/hex-map-model';
import { HexObjectFactory } from '../../factory/hex-object-factory';

export class SpawnResourceFeature {
  private readonly map: HexMapModel;

  constructor(mapModel: HexMapModel) {
    this.map = mapModel;
  }

  public spawn(now: number, scope?: BoardPlacementScope): boolean {
    let changed = false;

    for (const tile of this.map.tiles) {
      const s = tile.resourceSpawner;
      if (!s?.enabled) continue;
      if (tile.hexobject) continue;

      if (typeof s.nextSpawnAt === 'number' && now >= s.nextSpawnAt) {
        if (scope) assertBoardPlacement(scope, s.proto.hexobjectKey);
        tile.hexobject = HexObjectFactory.create(
          s.proto.hexobjectKey,
          tile.coordinates,
          s.proto.overrides,
        );
        s.nextSpawnAt = null;
        changed = true;
      }
    }

    return changed;
  }
}
