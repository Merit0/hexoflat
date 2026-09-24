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
      <template v-if="descriptor?.kind === 'DUNGEON'">
        <dt>Seed</dt>
        <dd>{{ descriptor.seed }}</dd>
        <dt>Layout</dt>
        <dd>{{ descriptor.layoutId }}</dd>
        <dt>Attempt</dt>
        <dd>{{ descriptor.attempt }}</dd>
      </template>
    </dl>

    <div v-if="descriptor?.kind === 'DUNGEON'" class="dev-board-panel__actions">
      <button type="button" @click="worldStore.devRegenerateDungeon()">Regenerate</button>
      <button type="button" @click="worldStore.devNextSeed()">Next seed</button>
      <div class="dev-board-panel__force-layout">
        <select v-model="selectedLayoutId">
          <option v-for="layoutId in availableLayouts" :key="layoutId" :value="layoutId">
            {{ layoutId }}
          </option>
        </select>
        <button type="button" @click="worldStore.devForceLayout(selectedLayoutId)">
          Force layout
        </button>
      </div>
    </div>

    <label class="dev-board-panel__toggle">
      <input
        type="checkbox"
        :checked="panelStore.showWholeBoard"
        @change="panelStore.toggleShowWholeBoard()"
      />
      Show whole board
    </label>

    <label class="dev-board-panel__toggle">
      <input
        type="checkbox"
        :checked="panelStore.showZoneOutlines"
        @change="panelStore.toggleShowZoneOutlines()"
      />
      Show zone outlines
    </label>

    <ul v-if="panelStore.showZoneOutlines && zoneLegend.length" class="dev-board-panel__legend">
      <li v-for="entry in zoneLegend" :key="entry.zoneId">
        <span
          class="dev-board-panel__swatch"
          :style="{ backgroundColor: cssColor(entry.color) }"
        ></span>
        {{ entry.zoneId }} — {{ entry.chunkId }}
      </li>
    </ul>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { MapRegistry } from '@hexoflat/engine/registry/world-map-registry';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useDevBoardPanelStore } from '@/stores/dev-board-panel-store';
import { computeZoneLegend } from '@/services/world/zone-tint';

const worldStore = useWorldMapStore();
const panelStore = useDevBoardPanelStore();

const descriptor = computed(() => worldStore.descriptor);
const zoneLegend = computed(() => computeZoneLegend(descriptor.value));
const availableLayouts = computed(
  () => MapRegistry.get(worldStore.currentLocationKey).availableLayouts ?? [],
);

const selectedLayoutId = ref(availableLayouts.value[0] ?? '');
watch(availableLayouts, (layouts) => {
  if (!layouts.includes(selectedLayoutId.value)) selectedLayoutId.value = layouts[0] ?? '';
});

function cssColor(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
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

.dev-board-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.dev-board-panel__force-layout {
  display: flex;
  gap: 4px;
}

.dev-board-panel__toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.dev-board-panel__legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dev-board-panel__swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  margin-right: 4px;
}
</style>
