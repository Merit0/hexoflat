import { computed, type Ref } from 'vue';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { findShortestPath } from '@hexoflat/engine/hero-movement/pathfinding-service';
import { getScoutMoveStepsForSteps } from '@hexoflat/engine/hero-movement/scout-progression';
import { coordinateKey, getOddQNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { EHexCollision, EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { getToolCapabilities } from '@hexoflat/engine/game-resolvers/interactions-resolver';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useCombatStore } from '@/stores/combat-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useHeroStore } from '@/stores/hero-store';
import { useUiSettingsStore } from '@/stores/ui-settings-store';

export interface UseMovePreviewDeps {
  hoveredTileCoord: Ref<IHexCoordinates | null>;
  getTileByCoord: (coord: IHexCoordinates) => IHexTile | undefined;
}

/**
 * Move/defend-marker preview shown as the player hovers a tile: whether the
 * hovered tile is reachable this turn, the path segments to draw, and the
 * marker's kind/cost. Same game rules the engine itself enforces on the
 * actual MOVE_HERO command — this is purely the preview, not authoritative.
 */
export function useMovePreview(deps: UseMovePreviewDeps) {
  const worldStore = useWorldMapStore();
  const combatStore = useCombatStore();
  const heroToolStore = useHeroToolStore();
  const uiSettingsStore = useUiSettingsStore();
  const heroStore = useHeroStore();

  const movePreview = computed(() => {
    const hoveredTileCoord = deps.hoveredTileCoord.value;

    if (!uiSettingsStore.showHeroMoveTrail) return null;
    if (!worldStore.map || !worldStore.heroCoordinates || !hoveredTileCoord) return null;
    if (worldStore.isHeroMoving) return null;
    if (combatStore.combatActive && combatStore.combatTurnSide !== 'hero') return null;

    const activeToolCapabilities = heroToolStore.activeTool
      ? getToolCapabilities(heroToolStore.activeTool)
      : {};

    if (
      combatStore.combatActive &&
      combatStore.combatTurnSide === 'hero' &&
      heroToolStore.isDragging &&
      activeToolCapabilities.canBlock &&
      combatStore.combatAttackUsed &&
      !combatStore.combatDefendUsed
    ) {
      const isAdjacent = getOddQNeighbors(worldStore.heroCoordinates).some(
        (coord) =>
          coord.columnIndex === hoveredTileCoord.columnIndex &&
          coord.rowIndex === hoveredTileCoord.rowIndex,
      );
      if (!isAdjacent) return null;

      const reachable = combatStore.canPlaceCombatDefendMarker(hoveredTileCoord);

      return {
        path: null,
        reachable,
        markerCoord: hoveredTileCoord,
        stepCost: 0,
        markerKind: 'defend' as const,
      };
    }

    const hasMovementSteps = combatStore.combatActive
      ? combatStore.combatStepsLeft > 0
      : getScoutMoveStepsForSteps(heroStore.hero?.heroSteps ?? 0) > 0;
    const hasNoActiveTool =
      !heroToolStore.isDragging &&
      (!heroToolStore.activeTool || heroToolStore.activeTool === HEXOBJECT_KEYS.HAND);
    if (!hasMovementSteps || !hasNoActiveTool) return null;

    const heroKey = coordinateKey(worldStore.heroCoordinates);
    const targetKey = coordinateKey(hoveredTileCoord);
    if (heroKey === targetKey) return null;

    const targetTile = deps.getTileByCoord(hoveredTileCoord);
    if (!targetTile) return null;

    const moveSteps = combatStore.combatActive
      ? combatStore.combatStepsLeft
      : getScoutMoveStepsForSteps(heroStore.hero?.heroSteps ?? 0);
    const path = findShortestPath(
      worldStore.map,
      worldStore.heroCoordinates,
      hoveredTileCoord,
      null,
    );

    const isTraversableTarget = Boolean(
      targetTile.isRevealed &&
      targetTile.hexobject?.groupType !== EHexobjectGroup.CONSTRUCTION &&
      targetTile.hexobject?.collision !== EHexCollision.SOLID &&
      targetTile.hexobject?.hexobjectKey !== HEXOBJECT_KEYS.CAMPING_ENTRANCE,
    );

    const route = path?.slice(1) ?? [];
    const reachable = isTraversableTarget && route.length > 0 && route.length <= moveSteps;

    return {
      path,
      reachable,
      markerCoord: isTraversableTarget ? hoveredTileCoord : null,
      stepCost: route.length,
      markerKind: 'move' as const,
    };
  });

  const segments = computed(() => {
    const path = movePreview.value?.path;
    if (!path || path.length < 2) return [];

    return path.slice(1);
  });

  const markerCoord = computed(() => movePreview.value?.markerCoord ?? null);
  const reachable = computed(() => movePreview.value?.reachable ?? false);
  const stepCost = computed(() => movePreview.value?.stepCost ?? 0);
  const markerKind = computed(() => movePreview.value?.markerKind ?? 'move');

  return { segments, markerCoord, reachable, stepCost, markerKind };
}
