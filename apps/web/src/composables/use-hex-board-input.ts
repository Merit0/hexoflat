import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { getOddQNeighbors, hexDistance } from '@hexoflat/engine/utils/hex-utils';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type { TEquipSlot } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { THeroToolKey } from '@hexoflat/engine/content/equipment.content';
import { useHeroStore } from '@/stores/hero-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';

const HAND_SCROLL_COOLDOWN_MS = 180;

export interface UseHexBoardInputDeps {
  hoveredTileCoord: Ref<IHexCoordinates | null>;
}

/**
 * Hand-tool equip/switch input: mouse-wheel cycles between the equipped
 * weapon/shield while a hand tool is dragging, snapping the tool's hover to
 * the nearest hero-adjacent tile so the preview never lands on an
 * unreachable hex.
 */
export function useHexBoardInput(deps: UseHexBoardInputDeps) {
  const heroStore = useHeroStore();
  const heroToolStore = useHeroToolStore();
  const heroInventoryStore = useHeroInventoryStore();

  const activeHandSlot = ref<TEquipSlot>('weapon');
  const lastHandScrollAt = ref(0);

  function resolveEquippedToolKey(slot: TEquipSlot): THeroToolKey | null {
    const item = heroInventoryStore.equippedItems[slot];
    if (!item) return null;

    switch (item.key) {
      case HEXOBJECT_KEYS.HAND:
        return HEXOBJECT_KEYS.HAND;
      case HEXOBJECT_KEYS.AXE:
        return HEXOBJECT_KEYS.AXE;
      case HEXOBJECT_KEYS.PICKAXE:
        return HEXOBJECT_KEYS.PICKAXE;
      case HEXOBJECT_KEYS.SWORD:
        return HEXOBJECT_KEYS.SWORD;
      case HEXOBJECT_KEYS.SHIELD:
        return HEXOBJECT_KEYS.SHIELD;
      default:
        return null;
    }
  }

  function resolvePreferredToolHover(): IHexCoordinates | null {
    const hoveredTileCoord = deps.hoveredTileCoord.value;
    if (!heroStore.heroCoordinates || !hoveredTileCoord) return null;

    const neighbors = getOddQNeighbors(heroStore.heroCoordinates);
    const target = hoveredTileCoord;

    const directNeighbor = neighbors.find(
      (coord) => coord.columnIndex === target.columnIndex && coord.rowIndex === target.rowIndex,
    );
    if (directNeighbor) return directNeighbor;

    let bestCoord: IHexCoordinates | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const neighbor of neighbors) {
      const distance = hexDistance(neighbor, target);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestCoord = neighbor;
      }
    }

    return bestCoord;
  }

  function equipToolFromHand(slot: TEquipSlot) {
    if (!heroStore.heroCoordinates) return;

    const toolKey = resolveEquippedToolKey(slot);
    if (!toolKey) return;

    activeHandSlot.value = slot;
    heroToolStore.useTool(toolKey, heroStore.heroCoordinates, resolvePreferredToolHover());
  }

  function onWheel(event: WheelEvent) {
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    ) {
      return;
    }

    if (heroToolStore.isLocked || !heroStore.heroCoordinates) return;
    if (event.deltaY === 0) return;

    event.preventDefault();

    const now = Date.now();
    if (now - lastHandScrollAt.value < HAND_SCROLL_COOLDOWN_MS) return;
    lastHandScrollAt.value = now;

    const handSlots: TEquipSlot[] = ['weapon', 'shield'];
    const currentIndex = handSlots.indexOf(activeHandSlot.value);
    const direction = event.deltaY > 0 ? 1 : -1;
    const nextIndex = (currentIndex + direction + handSlots.length) % handSlots.length;
    const nextSlot = handSlots[nextIndex];

    equipToolFromHand(nextSlot);
  }

  onMounted(() => window.addEventListener('wheel', onWheel, { passive: false }));
  onBeforeUnmount(() => window.removeEventListener('wheel', onWheel));

  return { activeHandSlot };
}
