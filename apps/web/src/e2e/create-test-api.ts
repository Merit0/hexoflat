import { findShortestPath } from '@hexoflat/engine/hero-movement/pathfinding-service';
import { isTerrainPassable } from '@hexoflat/engine/boards/terrain';
import { KNOWLEDGE_RULES } from '@hexoflat/engine/knowledge/math';
import { writeKnowledge } from '@/services/persistence/knowledge-storage';
import { getHexNeighbors, hexDistance } from '@hexoflat/engine/utils/hex-utils';
import {
  tileWorldCenter,
  worldToScreen,
  type BoardCamera,
  type PaneSize,
} from '@/render/board-camera';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroInventoryStore, WILL_SLOT_KEY } from '@/stores/hero-inventory-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { skillIdSchema } from '@hexoflat/engine/skills/skill-content';
import { usePortal } from '@/composables/use-portal';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import type {
  HexoflatTestApi,
  TestGridSize,
  TestHeroHealth,
  TestHexCoordinates,
  TestPortalPreview,
  TestTileFraction,
} from '@/e2e/test-api.types';

export interface CreateTestApiOptions {
  getCamera(): BoardCamera;
  getCanvasSize(): PaneSize;
  isBoardReady(): boolean;
}

/**
 * Builds the `window.__HEXOFLAT_TEST__` implementation out of the app's own
 * sources of truth: the engine's hex math, the world-map store and the
 * inventory store. Nothing here re-derives geometry — that duplication is
 * exactly what this API exists to delete from the e2e package.
 *
 * Only ever reached from a build with VITE_E2E_HOOKS=true (see test-hooks.ts).
 */
export function createTestApi(options: CreateTestApiOptions): HexoflatTestApi {
  const worldStore = useWorldMapStore();
  const heroStore = useHeroStore();
  const heroInventoryStore = useHeroInventoryStore();
  const heroToolStore = useHeroToolStore();
  const portal = usePortal();

  function findTile(coordinates: TestHexCoordinates) {
    return worldStore.map?.tiles.find(
      (tile) =>
        tile.coordinates.columnIndex === coordinates.columnIndex &&
        tile.coordinates.rowIndex === coordinates.rowIndex,
    );
  }

  return {
    getKnowledge() {
      const state = heroStore.knowledge;
      if (!state) return null;
      const session = state.session;
      const question = session?.question;
      return {
        current: state.current,
        status: session?.status ?? null,
        index: session?.index ?? 0,
        options: question?.options ?? [],
        answer: question?.answer ?? null,
        lastAward: session?.lastAward ?? 0,
      };
    },
    prepareKnowledgeWorld(current: number) {
      if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
      if (
        !heroStore.knowledge ||
        !Number.isInteger(current) ||
        current < 0 ||
        current > KNOWLEDGE_RULES.capacity
      )
        throw new Error('Invalid fixture');
      const state = { ...heroStore.knowledge, current, session: null };
      writeKnowledge(state);
      heroStore.loadKnowledge();
      worldStore.goToLocation('silesia');
    },
    setWill(current: number) {
      if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
      if (!heroStore.knowledge || !Number.isInteger(current) || current < 0)
        throw new Error('Invalid fixture');
      writeKnowledge({ ...heroStore.knowledge, current });
      heroStore.loadKnowledge();
    },
    setSkillRank(skillId: string, rank: number) {
      if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
      const parsed = skillIdSchema.safeParse(skillId);
      if (!heroStore.knowledge || !parsed.success || !Number.isInteger(rank) || rank < 0)
        throw new Error('Invalid fixture');
      const skills = { ...heroStore.knowledge.skills, [parsed.data]: rank };
      writeKnowledge({ ...heroStore.knowledge, skills });
      heroStore.loadKnowledge();
    },
    getWalkRoute(to: TestHexCoordinates): TestHexCoordinates[] | null {
      const from = heroStore.heroCoordinates;
      const map = worldStore.map;
      if (!from || !map) return null;
      const clickable = {
        tiles: map.tiles.map((tile) => ({
          coordinates: tile.coordinates,
          hexobject: tile.hexobject,
          terrain: tile.terrain,
          isRevealed: !tile.hexobject,
        })),
      };
      return findShortestPath(clickable, from, to)?.slice(1) ?? null;
    },
    getWillSlotKey() {
      return WILL_SLOT_KEY;
    },
    getKnowledgeRules() {
      return { startingWill: KNOWLEDGE_RULES.startingWill, capacity: KNOWLEDGE_RULES.capacity };
    },
    isBoardReady(): boolean {
      return options.isBoardReady();
    },

    getHeroCoordinates(): TestHexCoordinates | null {
      const coordinates = heroStore.heroCoordinates;
      return coordinates
        ? { columnIndex: coordinates.columnIndex, rowIndex: coordinates.rowIndex }
        : null;
    },

    getTileFraction(coordinates: TestHexCoordinates): TestTileFraction {
      const canvas = options.getCanvasSize();

      if (!canvas.width || !canvas.height) {
        throw new Error(
          'getTileFraction() called before the board had a real size — wait for isBoardReady().',
        );
      }

      const center = worldToScreen(options.getCamera(), tileWorldCenter(coordinates));

      return { fx: center.x / canvas.width, fy: center.y / canvas.height };
    },

    getNeighbors(coordinates: TestHexCoordinates): TestHexCoordinates[] {
      return getHexNeighbors(coordinates);
    },

    getDistance(from: TestHexCoordinates, to: TestHexCoordinates): number {
      return hexDistance(from, to);
    },

    getTileHexobjectKey(coordinates: TestHexCoordinates): string | null {
      return findTile(coordinates)?.hexobject?.hexobjectKey ?? null;
    },

    getExitTile(side): TestHexCoordinates | null {
      const exit = worldStore.map?.tiles.find((tile) => tile.exit === side);
      return exit
        ? { columnIndex: exit.coordinates.columnIndex, rowIndex: exit.coordinates.rowIndex }
        : null;
    },

    isTileImpassableTerrain(coordinates: TestHexCoordinates): boolean {
      const tile = findTile(coordinates);
      return !!tile && !isTerrainPassable(tile.terrain);
    },

    getHeroHealth(): TestHeroHealth {
      return {
        current: heroStore.hero.currentHealth ?? 0,
        max: heroStore.hero.getEffectiveMaxHealth(),
      };
    },

    getInventoryItemKeys(): string[] {
      return heroInventoryStore.items.map((item) => item.key);
    },

    getInventoryItemIdByKey(key: string): string | null {
      return heroInventoryStore.items.find((item) => item.key === key)?.id ?? null;
    },

    getGridSize(): TestGridSize {
      const map = worldStore.map;
      return { width: map?.width ?? 0, height: map?.height ?? 0 };
    },

    isToolUsed(): boolean {
      return heroToolStore.isDragging;
    },

    getToolHoverCoordinates(): TestHexCoordinates | null {
      const hover = heroToolStore.hover;
      return hover ? { columnIndex: hover.columnIndex, rowIndex: hover.rowIndex } : null;
    },

    getCurrentLocationKey(): string {
      return worldStore.currentLocationKey;
    },

    findTilesWithKey(key: string): TestHexCoordinates[] {
      return (worldStore.map?.tiles ?? [])
        .filter((tile) => tile.hexobject?.hexobjectKey === key)
        .map((tile) => ({
          columnIndex: tile.coordinates.columnIndex,
          rowIndex: tile.coordinates.rowIndex,
        }));
    },

    getInventoryItemAmount(key: string): number {
      return heroInventoryStore.countItem(key as THexobjectKey);
    },

    grantInventoryItem(key: string, amount: number) {
      if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
      const result = heroInventoryStore.putToInventory(key as THexobjectKey, amount);
      if (!result.ok) throw new Error(`Cannot grant ${amount} x ${key}`);
    },
    setHeroHealth(current: number) {
      if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
      if (!Number.isFinite(current) || current < 0) throw new Error('Invalid fixture');
      heroStore.hero.setHealth(current);
      heroStore.hero.adjustHealthOnStatChange();
      heroStore.saveProgressToStorage();
    },

    previewPortalOpening(coordinates: TestHexCoordinates): TestPortalPreview {
      const preview = portal.previewOpen(coordinates);
      return preview.ok
        ? { ok: true, oneWay: preview.oneWay, reason: null }
        : { ok: false, oneWay: false, reason: preview.reason };
    },
  };
}
