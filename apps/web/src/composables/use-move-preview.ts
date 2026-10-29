import { stepCost as willPerStep, travelStepBudget } from '@hexoflat/engine/knowledge/math';
import { willZoneCharges } from '@hexoflat/engine/knowledge/will-zone';
import { computed, type Ref } from 'vue';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { findShortestPath } from '@hexoflat/engine/hero-movement/pathfinding-service';
import { getScoutMoveStepsForSteps } from '@hexoflat/engine/hero-movement/scout-progression';
import { coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import { EHexCollision, EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { watchingSquad } from '@hexoflat/engine/squads/squad-state';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useBattleStore } from '@/stores/battle-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useHeroStore } from '@/stores/hero-store';
import { useUiSettingsStore } from '@/stores/ui-settings-store';

export interface UseMovePreviewDeps {
  hoveredTileCoord: Ref<IHexCoordinates | null>;
  getTileByCoord: (coord: IHexCoordinates) => IHexTile | undefined;
}

/**
 * Move preview shown as the player hovers a tile: whether the hovered tile
 * is reachable, the path segments to draw, and the marker's cost — or
 * SEEN! when the walk would end next to a sentry. Same game rules the engine itself enforces on the
 * actual MOVE_HERO command — this is purely the preview, not authoritative.
 */
export function useMovePreview(deps: UseMovePreviewDeps) {
  const worldStore = useWorldMapStore();
  const battleStore = useBattleStore();
  const heroToolStore = useHeroToolStore();
  const uiSettingsStore = useUiSettingsStore();
  const heroStore = useHeroStore();

  const availableWorldSteps = computed(() =>
    travelStepBudget(
      getScoutMoveStepsForSteps(heroStore.hero?.heroSteps ?? 0),
      heroStore.knowledge?.current ?? 0,
      heroStore.willZoneContext,
    ),
  );

  const movePreview = computed(() => {
    const hoveredTileCoord = deps.hoveredTileCoord.value;

    if (!uiSettingsStore.showHeroMoveTrail) return null;
    if (!worldStore.map || !heroStore.heroCoordinates || !hoveredTileCoord) return null;
    if (heroStore.isHeroMoving) return null;
    if (battleStore.inBattle) return null;

    const hasMovementSteps = getScoutMoveStepsForSteps(heroStore.hero?.heroSteps ?? 0) > 0;
    const hasNoActiveTool =
      !heroToolStore.isDragging &&
      (!heroToolStore.activeTool || heroToolStore.activeTool === HEXOBJECT_KEYS.HAND);
    if (!hasMovementSteps || !hasNoActiveTool) return null;

    const heroKey = coordinateKey(heroStore.heroCoordinates);
    const targetKey = coordinateKey(hoveredTileCoord);
    if (heroKey === targetKey) return null;

    const targetTile = deps.getTileByCoord(hoveredTileCoord);
    if (!targetTile) return null;

    const moveSteps = availableWorldSteps.value;
    const path = findShortestPath(
      worldStore.map,
      heroStore.heroCoordinates,
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
    const map = worldStore.map as HexMapModel;
    const seen = reachable && route.some((step) => !!watchingSquad(map, step));

    return {
      path,
      reachable,
      markerCoord: isTraversableTarget ? hoveredTileCoord : null,
      stepCost: route.length * willPerStep(heroStore.willZoneContext),
      chargesWill: willZoneCharges(heroStore.willZoneContext),
      markerKind: seen ? ('seen' as const) : ('move' as const),
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
  const chargesWill = computed(() => movePreview.value?.chargesWill ?? false);
  const markerKind = computed(() => movePreview.value?.markerKind ?? 'move');

  return { segments, markerCoord, reachable, stepCost, chargesWill, markerKind };
}
