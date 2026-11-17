import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { getHexNeighbors, hexDistance } from '@hexoflat/engine/utils/hex-utils';
import type { TEquipSlot } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { THeroToolKey } from '@hexoflat/engine/content/equipment.content';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { toolKeyOfItem } from '@/composables/hand-tools';
import { knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useTraderStore } from '@/stores/trader-store';
import { useActiveMapContext } from '@/composables/use-active-map-context';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';

export const HAND_SCROLL_COOLDOWN_MS = 180;

export interface UseHexBoardInputDeps {
  surface: Ref<HTMLElement | null>;
  hoveredTileCoord: Ref<IHexCoordinates | null>;
  heroCoordinates?: Ref<IHexCoordinates | null>;
  enabled?: Ref<boolean>;
  blocked?: Ref<boolean>;
}

/**
 * Hand-tool equip/switch input: mouse-wheel cycles between the equipped
 * weapon/shield while a hand tool is dragging, snapping the tool's hover to
 * the nearest hero-adjacent tile so the preview never lands on an
 * unreachable hex.
 */
export function useHexBoardInput(deps: UseHexBoardInputDeps) {
  const activeMap = useActiveMapContext();
  const heroToolStore = useHeroToolStore();
  const heroInventoryStore = useHeroInventoryStore();

  const stashStore = useHeroStashStore();
  const traderStore = useTraderStore();
  const heroCoordinates = deps.heroCoordinates ?? computed(() => activeMap.value.heroPosition);
  const toolIsWorking =
    deps.blocked ??
    computed(() => !!knowledgePanelMode.value || stashStore.isOpen || traderStore.isOpen);

  const activeHandSlot = ref<TEquipSlot>('weapon');
  const lastHandScrollAt = ref(0);

  function resolveEquippedToolKey(slot: TEquipSlot): THeroToolKey | null {
    return toolKeyOfItem(heroInventoryStore.equippedItems[slot]?.key);
  }

  function resolvePreferredToolHover(): IHexCoordinates | null {
    const hoveredTileCoord = deps.hoveredTileCoord.value;
    if (!heroCoordinates.value || !hoveredTileCoord) return null;

    const neighbors = getHexNeighbors(heroCoordinates.value);
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
    if (!heroCoordinates.value) return;

    const toolKey = resolveEquippedToolKey(slot);
    if (!toolKey) return;

    activeHandSlot.value = slot;
    heroToolStore.useTool(toolKey, heroCoordinates.value, resolvePreferredToolHover());
  }

  function onWheel(event: WheelEvent) {
    if (deps.enabled && !deps.enabled.value) return;
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    ) {
      return;
    }

    if (heroToolStore.isBusy || toolIsWorking.value || !heroCoordinates.value) return;
    if (event.deltaY === 0) return;

    event.preventDefault();

    const now = Date.now();
    if (now - lastHandScrollAt.value < HAND_SCROLL_COOLDOWN_MS) return;
    lastHandScrollAt.value = now;

    const handSlots: TEquipSlot[] = ['weapon', 'shield'];
    if (!heroToolStore.isDragging) {
      const hand = handSlots.find((slot) => resolveEquippedToolKey(slot) === HEXOBJECT_KEYS.HAND);
      if (hand) {
        equipToolFromHand(hand);
        return;
      }
    }
    const currentSlot =
      handSlots.find((slot) => resolveEquippedToolKey(slot) === heroToolStore.activeTool) ??
      activeHandSlot.value;
    const currentIndex = handSlots.indexOf(currentSlot);
    const direction = event.deltaY > 0 ? 1 : -1;
    const nextIndex = (currentIndex + direction + handSlots.length) % handSlots.length;
    const nextSlot = handSlots[nextIndex];

    equipToolFromHand(nextSlot);
  }

  let listeningOn: HTMLElement | null = null;
  onMounted(() => {
    listeningOn = deps.surface.value;
    listeningOn?.addEventListener('wheel', onWheel, { passive: false });
  });
  onBeforeUnmount(() => {
    listeningOn?.removeEventListener('wheel', onWheel);
    listeningOn = null;
  });

  return { activeHandSlot };
}
