import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import type { THeroToolKey } from '@hexoflat/engine/content/equipment.content';
import { i18n } from '@/i18n';
import { lootRefusalText } from '@/services/loot/loot-rejection';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { lootFlying } from '@/services/loot/loot-flight-state';
import { useWorldMapStore } from '@/stores/world-map-store';
import type { TestChest, TestGroundItem, TestHexCoordinates } from './test-api.types';

const GROUND_GROUPS = new Set<EHexobjectGroup>([
  EHexobjectGroup.LOOT,
  EHexobjectGroup.TOOL,
  EHexobjectGroup.EQUIPMENT,
]);

export const lootTestApi = {
  getGroundItems(): TestGroundItem[] {
    const tiles = useWorldMapStore().map?.tiles ?? [];
    return tiles.flatMap((tile) => {
      const object = tile.hexobject;
      if (!object || !GROUND_GROUPS.has(object.groupType)) return [];
      const quantity =
        object.quantity ?? (object.groupType === EHexobjectGroup.LOOT ? object.loot.amount : 1);
      return [
        {
          coordinates: {
            columnIndex: tile.coordinates.columnIndex,
            rowIndex: tile.coordinates.rowIndex,
          },
          itemKey: object.hexobjectKey,
          quantity: quantity ?? 1,
        },
      ];
    });
  },
  getChests(): TestChest[] {
    const tiles = useWorldMapStore().map?.tiles ?? [];
    return tiles.flatMap((tile) => {
      const key = tile.hexobject?.hexobjectKey;
      if (key !== HEXOBJECT_KEYS.CHEST && key !== HEXOBJECT_KEYS.CHEST_OPEN) return [];
      return [
        {
          coordinates: {
            columnIndex: tile.coordinates.columnIndex,
            rowIndex: tile.coordinates.rowIndex,
          },
          state: key === HEXOBJECT_KEYS.CHEST ? ('full' as const) : ('empty' as const),
        },
      ];
    });
  },
  async tryOpenChest(coordinates: TestHexCoordinates): Promise<void> {
    if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
    const world = useWorldMapStore();
    const tile = world.getTileAt(coordinates);
    if (!tile) throw new Error('No tile at the chest coordinates');
    const answer = await world.executeHexAction(tile, EHexActionType.OPEN, HEXOBJECT_KEYS.HAND);
    const text = lootRefusalText(answer.events, (key) => i18n.global.t(key)) ?? answer.message;
    if (!answer.ok && text) useHeroToolStore().setActionMessage(text);
  },
  isLootFlying(): boolean {
    return lootFlying.value;
  },
};
