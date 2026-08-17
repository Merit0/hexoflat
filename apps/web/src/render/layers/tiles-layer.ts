import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import { calcHexPixelPosition, coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { getMeta, getPrototype } from '@hexoflat/engine';
import { applyCoverFit, createHexHitArea, createHexMask, drawHexMask } from '@/render/hex-geometry';
import { getTexture, onTextureReady } from '@/render/texture-cache';
import type { useWorldMapStore } from '@/stores/world-map-store';
import type { useCombatStore } from '@/stores/combat-store';

const FOG_TILE_URL = '/hex-assets/hex-effects/fog-tile-image.png';
const DEFAULT_BG_URL = '/hex-assets/token-placement-image.png';

/**
 * `OBSERVED` is drawn as a dimmed silhouette: the player can see that
 * *something* is over there and roughly what kind of thing it is, but not
 * what it is. Design §36 asks for "fog/partial treatment" — the fog texture
 * plus a knocked-back alpha is that, and it reads as distinctly less resolved
 * than a `DISCOVERED` tile next to it.
 */
const OBSERVED_TILE_ALPHA = 0.55;

/**
 * Whether a tile's contents may be drawn at all.
 *
 * Note what is *not* here: `UNKNOWN`. An unknown hex never reaches this layer
 * under the exploration slice — it is filtered out upstream in
 * `use-hex-board-sizing.ts`, so no node is ever created for it, which is what
 * invariant I13 (no rectangular player-facing map) actually requires. With
 * the slice off, `UNKNOWN` is exactly the old `isRevealed === false` and still
 * gets the fog tile it always did.
 */
function isFullyRevealed(tile: IHexTile): boolean {
  return tile.discovery === 'DISCOVERED' || tile.discovery === 'UNDERSTOOD';
}

type WorldStore = ReturnType<typeof useWorldMapStore>;
type CombatStore = ReturnType<typeof useCombatStore>;

export interface TilesLayerDeps {
  worldContainer: Container;
  getTileSize(): { w: number; h: number };
  worldStore: WorldStore;
  combatStore: CombatStore;
  onTileHover: (tile: IHexTile) => void;
  onTileClick: (tile: IHexTile) => void;
}

interface TileNode {
  root: Container;
  mask: Graphics;
  bg: Sprite;
  sprite: Sprite;
  defendMarker: Sprite | null;
  lockChip: Text | null;
  unsubscribers: Array<() => void>;
  // The node currently at this coordinate key is reused across `syncTiles`
  // calls — including across location switches (camping <-> world map),
  // which hand in a brand-new `IHexTile` object per coordinate. Click/hover
  // handlers read this mutable field (kept fresh in `syncTiles`) instead of
  // closing over the `tile` argument `createNode` was first called with,
  // which would otherwise stay frozen to whichever location's tile happened
  // to be at this coordinate the first time a node was ever created here.
  tile: IHexTile;
}

export interface TilesLayer {
  container: Container;
  /**
   * `dirtyKeys` (from `coordinateKey`) limits mask/hitArea/position/texture
   * recompute to just those tiles — pass omitted/undefined for a full sync
   * (initial mount, a tile-size change, or a wholesale tile-array swap).
   * Node creation for never-seen tiles and pruning of removed ones always
   * runs over the full `tiles` array regardless, since dirty tracking only
   * covers *mutated* tiles, not additions/removals.
   */
  syncTiles(tiles: IHexTile[], dirtyKeys?: Set<string>): void;
  syncLockChips(tiles: IHexTile[], nowTick: number): void;
  syncDefendMarkers(tiles: IHexTile[]): void;
  destroy(): void;
}

function constructionLockLabel(
  tile: IHexTile,
  nowTick: number,
  worldStore: WorldStore,
): string | null {
  const hexobject = tile.hexobject;
  if (!isFullyRevealed(tile) || !hexobject) return null;
  if (hexobject.groupType !== EHexobjectGroup.CONSTRUCTION) return null;

  const enterCfg = getMeta(hexobject.hexobjectKey)?.enter;
  if (enterCfg?.type === 'WORLD') {
    const remainingMs = worldStore.getLocationRespawnRemainingMs(enterCfg.locationKey);
    if (remainingMs > 0) {
      const totalSeconds = Math.ceil(remainingMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  }

  if (!hexobject.isInteractable && hexobject.construction.isLocked) {
    return 'locked';
  }

  return null;
}

function defendMarkerSpritePath(tile: IHexTile, combatStore: CombatStore): string | null {
  if (!isFullyRevealed(tile)) return null;

  const marker = combatStore.combatMarkers.find(
    (item) =>
      item.visible &&
      item.kind === 'defend' &&
      item.coord.columnIndex === tile.coordinates.columnIndex &&
      item.coord.rowIndex === tile.coordinates.rowIndex,
  );
  if (!marker?.toolKey) return null;

  return getPrototype(marker.toolKey)?.spritePath ?? null;
}

export function createTilesLayer(deps: TilesLayerDeps): TilesLayer {
  const container = new Container();
  deps.worldContainer.addChild(container);

  const nodes = new Map<string, TileNode>();

  function createNode(tile: IHexTile): TileNode {
    const { w, h } = deps.getTileSize();
    const root = new Container();
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.hitArea = createHexHitArea(w, h);

    const mask = createHexMask(w, h);
    const bg = new Sprite();
    const sprite = new Sprite();

    root.addChild(mask, bg, sprite);
    root.mask = mask;
    container.addChild(root);

    const node: TileNode = {
      root,
      mask,
      bg,
      sprite,
      defendMarker: null,
      lockChip: null,
      unsubscribers: [],
      tile,
    };

    root.on('pointertap', () => deps.onTileClick(node.tile));
    root.on('pointerover', () => deps.onTileHover(node.tile));

    return node;
  }

  function positionNode(node: TileNode, tile: IHexTile, w: number, h: number) {
    const { x, y } = calcHexPixelPosition(tile, w, h);
    node.root.position.set(x, y);
  }

  function applyTexture(sprite: Sprite, path: string, node: TileNode) {
    const fit = () => {
      const { w, h } = deps.getTileSize();
      applyCoverFit(sprite, w, h);
    };

    sprite.texture = getTexture(path);
    fit();

    const unsubscribe = onTextureReady(path, () => {
      sprite.texture = getTexture(path);
      fit();
    });
    node.unsubscribers.push(unsubscribe);
  }

  function syncTileVisual(node: TileNode, tile: IHexTile) {
    for (const unsub of node.unsubscribers) unsub();
    node.unsubscribers = [];

    const revealed = isFullyRevealed(tile);

    // OBSERVED shares the fog texture with UNKNOWN rather than getting one of
    // its own: what separates them on screen is that UNKNOWN has no tile at
    // all, so a fogged shape *is* the "there is something there" signal.
    const bgPath = revealed ? tile.hexBackgroundImagePath || DEFAULT_BG_URL : FOG_TILE_URL;
    applyTexture(node.bg, bgPath, node);
    node.root.alpha = tile.discovery === 'OBSERVED' ? OBSERVED_TILE_ALPHA : 1;

    // No hexobject (fogged, or revealed-but-empty) means no sprite to draw —
    // leave the layer empty so the bg texture (fog pattern, or the
    // token-placement pattern for an empty revealed tile) shows through
    // instead of being blotted out by a filler image. An OBSERVED tile is
    // treated as unrevealed here on purpose: drawing its hexobject sprite
    // would hand the player the exact identity that observation is defined
    // not to give them (invariant I3).
    const spritePath = revealed ? tile.hexobject?.spritePath : null;
    if (!spritePath) {
      node.sprite.texture = Texture.EMPTY;
      return;
    }

    applyTexture(node.sprite, spritePath, node);
  }

  function syncTiles(tiles: IHexTile[], dirtyKeys?: Set<string>) {
    const { w, h } = deps.getTileSize();
    const seen = new Set<string>();

    for (const tile of tiles) {
      const key = coordinateKey(tile.coordinates);
      seen.add(key);

      let node = nodes.get(key);
      const isNewNode = !node;
      if (!node) {
        node = createNode(tile);
        nodes.set(key, node);
      }
      node.tile = tile;

      // A node that was just created has never been positioned/drawn, so it
      // always needs the full treatment regardless of the dirty set.
      if (!dirtyKeys || isNewNode || dirtyKeys.has(key)) {
        drawHexMask(node.mask, w, h);
        applyCoverFit(node.bg, w, h);
        applyCoverFit(node.sprite, w, h);
        node.root.hitArea = createHexHitArea(w, h);

        positionNode(node, tile, w, h);
        syncTileVisual(node, tile);
      }
    }

    for (const [key, node] of nodes) {
      if (seen.has(key)) continue;
      for (const unsub of node.unsubscribers) unsub();
      node.root.destroy({ children: true });
      nodes.delete(key);
    }
  }

  function syncLockChips(tiles: IHexTile[], nowTick: number) {
    for (const tile of tiles) {
      const node = nodes.get(coordinateKey(tile.coordinates));
      if (!node) continue;

      const label = constructionLockLabel(tile, nowTick, deps.worldStore);
      const { w, h } = deps.getTileSize();

      if (!label) {
        if (node.lockChip) {
          node.lockChip.destroy();
          node.lockChip = null;
        }
        continue;
      }

      if (!node.lockChip) {
        node.lockChip = new Text({
          text: label,
          style: {
            fontFamily: 'Cinzel, serif',
            fontSize: 11,
            fontWeight: '800',
            fill: 0xf2e9d3,
            letterSpacing: 1,
          },
        });
        node.lockChip.anchor.set(0.5);
        node.root.addChild(node.lockChip);
      }

      node.lockChip.text = label;
      node.lockChip.position.set(w / 2, h / 2);
    }
  }

  function syncDefendMarkers(tiles: IHexTile[]) {
    for (const tile of tiles) {
      const node = nodes.get(coordinateKey(tile.coordinates));
      if (!node) continue;

      const path = defendMarkerSpritePath(tile, deps.combatStore);
      const { w, h } = deps.getTileSize();

      if (!path) {
        if (node.defendMarker) {
          node.defendMarker.destroy();
          node.defendMarker = null;
        }
        continue;
      }

      if (!node.defendMarker) {
        node.defendMarker = new Sprite();
        node.defendMarker.anchor.set(0.5, 0.6);
        node.defendMarker.position.set(w / 2, h / 2);
        node.root.addChildAt(node.defendMarker, 2);
      }

      node.defendMarker.texture = getTexture(path);

      const tex = node.defendMarker.texture;
      const targetWidth = w * 0.68;
      if (tex.width && tex.height) {
        const scale = targetWidth / tex.width;
        node.defendMarker.width = tex.width * scale;
        node.defendMarker.height = tex.height * scale;
      } else {
        node.defendMarker.width = targetWidth;
        node.defendMarker.height = h * 0.68;
      }
    }
  }

  return {
    container,
    syncTiles,
    syncLockChips,
    syncDefendMarkers,
    destroy() {
      for (const node of nodes.values()) {
        for (const unsub of node.unsubscribers) unsub();
        node.root.destroy({ children: true });
      }
      nodes.clear();
      container.destroy({ children: true });
    },
  };
}
