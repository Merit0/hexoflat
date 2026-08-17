import type { IHexCoordinates } from '../interfaces/hex-tile-config-interface';
import { HexTileModel } from '../models/hex-tile-model';
import type { DiscoveryState } from '../discovery-state';

type HexTileDraft = Partial<
  Pick<
    HexTileModel,
    'tileId' | 'coordinates' | 'isRevealed' | 'discovery' | 'hexBackgroundImagePath'
  >
>;

export class HexTileBuilder {
  private draft: HexTileDraft = {};

  isRevealed(revealedStatus: boolean): this {
    this.draft.isRevealed = revealedStatus;
    return this;
  }

  /**
   * Sets the four-state discovery directly. Wins over `isRevealed()` on the
   * same draft regardless of call order, since the boolean can only ever mean
   * `DISCOVERED`/`UNKNOWN` and this can say `OBSERVED`/`UNDERSTOOD` too.
   */
  discovery(discovery: DiscoveryState): this {
    this.draft.discovery = discovery;
    return this;
  }

  hexBackgroundImagePath(hexBackgroundImagePath: string): this {
    this.draft.hexBackgroundImagePath = hexBackgroundImagePath;
    return this;
  }

  coordinates(coordinates: IHexCoordinates): this {
    this.draft.coordinates = coordinates;
    return this;
  }

  private reset(): this {
    this.draft = {};
    return this;
  }

  build(): HexTileModel {
    if (!this.draft.coordinates) throw new Error('HexTileBuilder: coordinates are required');

    const tile = new HexTileModel();

    tile.isRevealed = this.draft.isRevealed ?? false;
    if (this.draft.discovery) tile.discovery = this.draft.discovery;
    tile.coordinates = this.draft.coordinates;
    tile.hexBackgroundImagePath = this.draft.hexBackgroundImagePath ?? '';

    this.reset();

    return tile;
  }
}
