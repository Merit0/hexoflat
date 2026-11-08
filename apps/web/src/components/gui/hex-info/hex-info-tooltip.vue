<template>
  <hex-info-popover :view="view" :anchor="target?.anchor ?? null" :hover-key="hoveredKey" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useBattleStore } from '@/stores/battle-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { useHexHoverInfo } from '@/composables/use-hex-hover-info';
import { buildHexInfo } from '@/services/hex-info/build-hex-info';
import HexInfoPopover from './hex-info-popover.vue';

const i18n = useI18n();
const t = (key: string, params?: Record<string, unknown>) => i18n.t(key, params ?? {});
const te = (key: string) => i18n.te(key);
const worldStore = useWorldMapStore();
const battleStore = useBattleStore();
const heroToolStore = useHeroToolStore();
const { target } = useHexHoverInfo();

const hoveredKey = computed(() => {
  const coordinates = target.value?.coordinates;
  return coordinates ? `${coordinates.columnIndex}:${coordinates.rowIndex}` : null;
});

const view = computed(() => {
  const key = hoveredKey.value;
  if (!key || battleStore.isOpen || heroToolStore.isDragging || knowledgePanelMode.value) {
    return null;
  }
  const [columnIndex, rowIndex] = key.split(':').map(Number);
  const tile = worldStore.map?.tiles.find(
    (candidate) =>
      candidate.coordinates.columnIndex === columnIndex &&
      candidate.coordinates.rowIndex === rowIndex,
  );
  if (!tile?.isRevealed || !tile.hexobject) return null;
  return buildHexInfo(tile.hexobject, t(`itemTooltip.group.${tile.hexobject.groupType}`), t, te);
});
</script>
