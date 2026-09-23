import { EHexCollision } from '../../../abstraction/hexobject-abstraction';
import type { THexobject } from '../../../abstraction/hexobject-abstraction';
import type { TileLike, TileMapLike } from '../../../hero-movement/movement-grid';
import { findShortestPath } from '../../../hero-movement/pathfinding-service';
import type { RegionTopologyGraph } from '../region-topology';
import type { EmbeddedHex } from '../embedded-board';

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
 * Re-verifies, using the engine's own pathfinding, that every OPEN edge of
 * the source graph is actually walkable once laid out in hexes. This is not
 * a formality: hex-line filling and shell construction both run after the
 * coarse layout, so this is the check that would catch either of them
 * accidentally severing a route.
 */
export function verifyEmbeddingConnectivity(
  graph: RegionTopologyGraph,
  hexes: EmbeddedHex[],
  anchorHexByNodeId: Map<string, EmbeddedHex>,
): { ok: true } | { ok: false; reason: string } {
  const tileMap = toTileMap(hexes);

  for (const edge of graph.edges) {
    if (edge.traversal !== 'OPEN') continue;

    const fromHex = anchorHexByNodeId.get(edge.from);
    const toHex = anchorHexByNodeId.get(edge.to);
    if (!fromHex || !toHex) {
      return { ok: false, reason: `edge "${edge.id}" references a node with no placed hex` };
    }

    const path = findShortestPath(tileMap, fromHex.coordinates, toHex.coordinates);
    if (!path) {
      return {
        ok: false,
        reason: `edge "${edge.id}" (${edge.from} -> ${edge.to}) is not traversable in the embedded hexes`,
      };
    }
  }

  return { ok: true };
}
