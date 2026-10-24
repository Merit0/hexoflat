<template>
  <aside class="dev-board-panel" data-testid="dev-board-panel">
    <header class="dev-board-panel__header">Board (dev)</header>

    <dl class="dev-board-panel__facts">
      <dt>Location</dt>
      <dd>{{ worldStore.currentLocationKey }}</dd>
      <dt>Kind</dt>
      <dd>{{ descriptor?.kind ?? '—' }}</dd>
      <template v-if="descriptor?.kind === 'STATIC'">
        <dt>Drawing hash</dt>
        <dd>{{ descriptor.drawingHash?.slice(0, 8) ?? '—' }}</dd>
      </template>
      <template v-if="descriptor?.kind === 'RECIPE'">
        <dt>Recipe</dt>
        <dd>{{ descriptor.recipeId }} v{{ descriptor.version }}</dd>
        <dt>Seed</dt>
        <dd>{{ descriptor.seed }}</dd>
        <dt>Attempt</dt>
        <dd>{{ descriptor.attempt }}</dd>
      </template>
    </dl>

    <section
      v-if="measurements"
      class="dev-board-panel__measurements"
      data-testid="dev-measurements"
    >
      <header class="dev-board-panel__header">Заміри</header>
      <dl class="dev-board-panel__facts">
        <dt>Гексів / прохідних</dt>
        <dd>{{ measurements.totalTiles }} / {{ measurements.passableTiles }}</dd>
        <dt>Сусідів (сер.)</dt>
        <dd>{{ measurements.meanPassableNeighbours.toFixed(2) }}</dd>
        <dt>≤2 сусідів</dt>
        <dd>{{ (measurements.shareLowDegree * 100).toFixed(0) }}%</dd>
        <dt>Найдальший</dt>
        <dd>{{ measurements.farthestPassableSteps }}</dd>
        <dt>Воля (сума)</dt>
        <dd>{{ measurements.willCostTotal }}</dd>
        <template v-for="(steps, key) in measurements.stepsToObject" :key="key">
          <dt>→ {{ key }}</dt>
          <dd>{{ steps ?? '—' }}</dd>
        </template>
      </dl>
    </section>

    <div v-if="descriptor?.kind === 'RECIPE'" class="dev-board-panel__actions">
      <button
        type="button"
        data-testid="dev-regenerate-button"
        @click="worldStore.devRegenerateDungeon()"
      >
        Regenerate
      </button>
      <button type="button" data-testid="dev-next-seed-button" @click="worldStore.devNextSeed()">
        Next seed
      </button>
    </div>

    <label v-if="canEditBoard" class="dev-board-panel__toggle">
      <input
        type="checkbox"
        data-testid="dev-edit-board-toggle"
        :checked="editorStore.isEditing"
        @change="onToggleEditBoard"
      />
      Edit board
    </label>

    <label class="dev-board-panel__toggle">
      <input
        type="checkbox"
        data-testid="dev-show-whole-board-toggle"
        :checked="panelStore.showWholeBoard"
        @change="panelStore.toggleShowWholeBoard()"
      />
      Show whole board
    </label>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { MapRegistry } from '@hexoflat/engine/registry/world-map-registry';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { measureBoard } from '@hexoflat/engine/boards/measure-board';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useDevBoardPanelStore } from '@/stores/dev-board-panel-store';
import { useStaticBoardEditorStore } from '@/stores/static-board-editor-store';

const worldStore = useWorldMapStore();
const panelStore = useDevBoardPanelStore();
const editorStore = useStaticBoardEditorStore();

const descriptor = computed(() => worldStore.descriptor);
const measurements = computed(() => {
  const map = worldStore.map as HexMapModel | null;
  if (!map) return null;
  return measureBoard(map, MapRegistry.get(worldStore.currentLocationKey).entryHexobjectKey);
});
const canEditBoard = computed(
  () => descriptor.value?.kind === 'STATIC' && descriptor.value.drawingHash !== undefined,
);

function onToggleEditBoard() {
  if (editorStore.isEditing) {
    editorStore.cancelEditing();
  } else {
    editorStore.startEditing(worldStore.currentLocationKey);
  }
}
</script>

<style scoped>
.dev-board-panel {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  background: rgb(0 0 0 / 70%);
  color: #fff;
  font-size: 11px;
  font-family: monospace;
  border-radius: 6px;
  max-width: 220px;
}

.dev-board-panel__header {
  font-weight: bold;
  opacity: 0.8;
}

.dev-board-panel__facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 8px;
  margin: 0;
}

.dev-board-panel__facts dt {
  opacity: 0.7;
}

.dev-board-panel__facts dd {
  margin: 0;
  word-break: break-all;
}

.dev-board-panel__measurements {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dev-board-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.dev-board-panel__toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
</style>
