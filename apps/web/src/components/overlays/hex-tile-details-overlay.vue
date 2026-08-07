<template>
  <div class="overlay-backdrop game-root" @click.self="close">
    <div class="overlay-card">
      <header class="overlay-header">
        <h2 data-testid="tile-details-title">{{ title }}</h2>
        <button
          class="close-btn"
          data-testid="tile-details-close-button"
          aria-label="Close"
          @click="close"
        >
          ✕
        </button>
      </header>

      <div v-if="tile" class="content" data-testid="tile-details-content">
        <div v-if="categoryLabel" class="row">
          <span class="label">{{ categoryLabel }}</span>
          <span>{{
            tile!.hexobject!.description
              ? t(tile!.hexobject!.description)
              : t('hexTileDetails.noFurtherDetails')
          }}</span>
        </div>
        <p v-else class="empty-note">{{ t('hexTileDetails.nothingOfInterest') }}</p>
      </div>

      <div v-else class="content empty">{{ t('hexTileDetails.tileNotFound') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useOverlayStore } from '@/stores/overlay-store';
import { OverlayPayloads } from '@/types/overlay-types';
import { EHexobjectGroup } from '@hexoflat/engine/abstraction/hexobject-abstraction';

const props = defineProps<{
  data: OverlayPayloads['hex-tile-details'];
}>();

const { t } = useI18n();
const worldMapStore = useWorldMapStore();
const overlayStore = useOverlayStore();

const CATEGORY_LABELS: Record<EHexobjectGroup, string> = {
  [EHexobjectGroup.RESOURCE]: 'Resource',
  [EHexobjectGroup.LOOT]: 'Loot',
  [EHexobjectGroup.CONSTRUCTION]: 'Construction',
  [EHexobjectGroup.CREATURE]: 'Creature',
  [EHexobjectGroup.TOOL]: 'Tool',
  [EHexobjectGroup.EQUIPMENT]: 'Equipment',
};

const tile = computed(() => {
  const map = worldMapStore.map;
  if (!map) return null;

  return (
    map.tiles.find(
      (t) =>
        t.coordinates.columnIndex === props.data.coordinates.columnIndex &&
        t.coordinates.rowIndex === props.data.coordinates.rowIndex,
    ) ?? null
  );
});

const categoryLabel = computed(() => {
  const hexobject = tile.value?.hexobject;
  if (!hexobject) return null;
  return CATEGORY_LABELS[hexobject.groupType] ?? null;
});

const title = computed(() => {
  const hexobject = tile.value?.hexobject;
  if (!hexobject) return t('hexTileDetails.emptyTile');

  if (hexobject.groupType === EHexobjectGroup.CREATURE) return t(hexobject.creature.name);
  if (hexobject.groupType === EHexobjectGroup.LOOT) return hexobject.loot.name;

  return categoryLabel.value ?? 'Hex Tile';
});

function close() {
  overlayStore.closeOverlay('hex-tile-details');
}
</script>

<style scoped>
.overlay-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
  z-index: 2000;
}
.overlay-card {
  width: min(520px, 92vw);
  background: #0f1115;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 14px;
  color: #e6e6e6;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}
.overlay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.close-btn {
  background: transparent;
  border: none;
  color: inherit;
  font-size: 18px;
  cursor: pointer;
}
.content {
  display: grid;
  gap: 8px;
}
.row {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 8px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}
.label {
  opacity: 0.7;
}
.empty {
  opacity: 0.7;
  text-align: center;
  padding: 20px;
}
.empty-note {
  opacity: 0.7;
  padding: 6px 8px;
}
</style>
