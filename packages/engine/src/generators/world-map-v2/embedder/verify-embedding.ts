import { EHexCollision } from '../../../abstraction/hexobject-abstraction';
import type { THexobject } from '../../../abstraction/hexobject-abstraction';
import type { IHexCoordinates } from '../../../map/interfaces/hex-tile-config-interface';
import type { TileLike, TileMapLike } from '../../../hero-movement/movement-grid';
import { findShortestPath } from '../../../hero-movement/pathfinding-service';
import type { EmbeddedHex } from '../embedded-board';
import type { AreaLink } from './contract-path-segments';

/**
 * A structural stand-in for "something solid is here" — not real game
 * content. G4 assigns real terrain/hexobjects from graph roles; this
 * verification never renders or persists, it only needs `isTraversableTile`
 * (packages/engine/src/hero-movement/movement-grid.ts) to see a `collision`
 * value, so a minimal cast is honest here rather than instantiating a real
 * registered hexobject (e.g. ROCK) that carries irrelevant resource fields.
 */
const BLOCKED_PLACEHOLDER = { collision: EHexCollision.SOLID } as unknown as THexobject;

function toTileMap(hexes: EmbeddedHex[]): TileMapLike {
  const tiles: TileLike[] = hexes.map((hex) => ({
    coordinates: hex.coordinates,
    isRevealed: true,
    hexobject: hex.passable ? null : BLOCKED_PLACEHOLDER,
  }));
  return { tiles };
}

/**
 * Re-verifies, using the engine's own pathfinding, that every named
 * from/to pair is actually walkable once laid out in hexes. This is not a
 * formality: growth, obstruction/landmark carving and link carving all run
 * after the coarse layout, so this is the check that would catch any of
 * them accidentally severing a route.
 */
export function verifyHexPathsExist(
  hexes: EmbeddedHex[],
  pairs: { id: string; from: IHexCoordinates; to: IHexCoordinates }[],
): { ok: true } | { ok: false; reason: string } {
  const tileMap = toTileMap(hexes);

  for (const pair of pairs) {
    const path = findShortestPath(tileMap, pair.from, pair.to);
    if (!path) {
      return { ok: false, reason: `"${pair.id}" is not traversable in the embedded hexes` };
    }
  }

  return { ok: true };
}

/**
 * G2b shape: verifies every contracted area-to-area link (PATH_SEGMENT
 * chains already collapsed into their link — see contract-path-segments.ts)
 * using each area's first grown hex as its representative anchor.
 */
export function verifyAreaLinksConnectivity(
  links: AreaLink[],
  hexes: EmbeddedHex[],
  anchorByAreaId: Map<string, IHexCoordinates>,
): { ok: true } | { ok: false; reason: string } {
  const pairs = links.map((link) => {
    const from = anchorByAreaId.get(link.from);
    const to = anchorByAreaId.get(link.to);
    return { id: link.id, from, to };
  });

  for (const pair of pairs) {
    if (!pair.from || !pair.to) {
      return { ok: false, reason: `link "${pair.id}" references an area with no anchor hex` };
    }
  }

  return verifyHexPathsExist(
    hexes,
    pairs as { id: string; from: IHexCoordinates; to: IHexCoordinates }[],
  );
}
