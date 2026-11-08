import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';

const TABS_HEIGHT_PX = 46;
const FOOTER_HEIGHT_PX = 22;
const GRID_PADDING_PX = 12;

export interface InventoryCellMetrics {
  cell: number;
  gap: number;
  pad: number;
}

export function inventoryBaseMetrics(viewportWidth: number): { cell: number; gap: number } {
  if (viewportWidth <= 900) return { cell: 56, gap: 4 };
  if (viewportWidth <= 1100) return { cell: 64, gap: 5 };
  return { cell: 76, gap: 4 };
}

/**
 * The size one Inventory cell takes on screen: its base cell scaled by the same
 * min(width, height) fit the Inventory tab applies to its whole grid inside the same panel.
 */
export function inventoryCellMetrics(input: {
  panelWidth: number;
  panelHeight: number;
  viewportWidth: number;
  columns: number;
  rows: number;
}): InventoryCellMetrics {
  const base = inventoryBaseMetrics(input.viewportWidth);
  const contentWidth =
    input.columns * base.cell + (input.columns - 1) * base.gap + 2 * GRID_PADDING_PX;
  const contentHeight = input.rows * base.cell + (input.rows - 1) * base.gap + 2 * GRID_PADDING_PX;
  const freeHeight = input.panelHeight - TABS_HEIGHT_PX - FOOTER_HEIGHT_PX;
  const scale = Math.max(
    0.1,
    Math.min(input.panelWidth / contentWidth, freeHeight / contentHeight),
  );
  return { cell: base.cell * scale, gap: base.gap * scale, pad: GRID_PADDING_PX * scale };
}

export function useInventoryCellSize(board: Ref<HTMLElement | null>) {
  const inventory = useHeroInventoryStore();
  const metrics = ref<InventoryCellMetrics>({ cell: 56, gap: 4, pad: 8 });
  let observer: ResizeObserver | null = null;

  function measure() {
    const panel = board.value?.parentElement;
    if (!panel) return;
    const box = panel.getBoundingClientRect();
    if (!box.width || !box.height) return;
    metrics.value = inventoryCellMetrics({
      panelWidth: box.width,
      panelHeight: box.height,
      viewportWidth: window.innerWidth,
      columns: inventory.grid.rows,
      rows: inventory.grid.cols,
    });
  }

  watch(
    board,
    (element) => {
      observer?.disconnect();
      const panel = element?.parentElement;
      if (!panel) return;
      observer = new ResizeObserver(measure);
      observer.observe(panel);
      measure();
    },
    { flush: 'post' },
  );

  onBeforeUnmount(() => observer?.disconnect());

  const style = computed(() => ({
    '--stash-cell': `${metrics.value.cell}px`,
    '--stash-gap': `${metrics.value.gap}px`,
    '--stash-pad': `${metrics.value.pad}px`,
  }));

  return { metrics, style };
}
