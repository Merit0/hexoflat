<template>
  <aside class="static-board-editor-panel" data-testid="static-board-editor-panel">
    <header class="static-board-editor-panel__header">
      Editing board: {{ editorStore.locationKey }}
    </header>

    <div v-if="editorStore.isPaletteOpen" class="static-board-editor-panel__palette">
      <div class="static-board-editor-panel__palette-title" data-testid="editor-palette-hex">
        Hex ({{ editorStore.selectedCoordinates?.columnIndex }},
        {{ editorStore.selectedCoordinates?.rowIndex }})
      </div>

      <div class="static-board-editor-panel__quick-tools">
        <button type="button" data-testid="editor-place-ground" @click="editorStore.placeGround()">
          Ground
        </button>
        <button type="button" data-testid="editor-place-wall" @click="editorStore.placeWall()">
          Wall
        </button>
        <button type="button" data-testid="editor-place-void" @click="editorStore.placeVoid()">
          Void
        </button>
      </div>

      <input
        class="static-board-editor-panel__search"
        type="text"
        placeholder="Search hexobject…"
        data-testid="editor-palette-search"
        :value="editorStore.paletteSearch"
        @input="onSearchInput"
      />

      <ul class="static-board-editor-panel__hexobject-list">
        <li v-for="entry in filteredHexobjects" :key="entry.key">
          <button
            type="button"
            :data-testid="`editor-palette-${entry.key}`"
            @click="editorStore.placeHexobject(entry.key)"
          >
            {{ entry.label }}
          </button>
        </li>
      </ul>

      <button
        type="button"
        data-testid="editor-palette-close-button"
        @click="editorStore.closePalette()"
      >
        Close
      </button>
    </div>

    <div class="static-board-editor-panel__actions">
      <button
        type="button"
        data-testid="editor-save-button"
        :disabled="editorStore.isSaving"
        @click="editorStore.save()"
      >
        {{ editorStore.isSaving ? 'Saving…' : 'Save' }}
      </button>
      <button type="button" data-testid="editor-cancel-button" @click="editorStore.cancelEditing()">
        Cancel
      </button>
    </div>

    <p v-if="editorStore.saveError" class="static-board-editor-panel__error">
      {{ editorStore.saveError }}
    </p>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { HEXOBJECT_KEYS, type THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { useStaticBoardEditorStore } from '@/stores/static-board-editor-store';

const editorStore = useStaticBoardEditorStore();

function humanizeHexobjectLabel(key: THexobjectKey): string {
  return key
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const hexobjectEntries = Object.values(HEXOBJECT_KEYS).map((key) => ({
  key,
  label: humanizeHexobjectLabel(key),
}));

const filteredHexobjects = computed(() => {
  const search = editorStore.paletteSearch.trim().toLowerCase();
  if (!search) return hexobjectEntries;
  return hexobjectEntries.filter((entry) => entry.label.toLowerCase().includes(search));
});

function onSearchInput(event: Event) {
  editorStore.setPaletteSearch((event.target as HTMLInputElement).value);
}
</script>

<style scoped>
.static-board-editor-panel {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  background: rgb(0 0 0 / 70%);
  color: #fff;
  font-size: 11px;
  font-family: monospace;
  border-radius: 6px;
  width: 220px;
  max-height: 80vh;
  overflow-y: auto;
}

.static-board-editor-panel__header {
  font-weight: bold;
  opacity: 0.8;
}

.static-board-editor-panel__palette {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px solid rgb(255 255 255 / 15%);
}

.static-board-editor-panel__quick-tools {
  display: flex;
  gap: 4px;
}

.static-board-editor-panel__search {
  width: 100%;
  box-sizing: border-box;
  font-family: monospace;
  font-size: 11px;
}

.static-board-editor-panel__hexobject-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 160px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.static-board-editor-panel__hexobject-list button {
  width: 100%;
  text-align: left;
}

.static-board-editor-panel__actions {
  display: flex;
  gap: 6px;
}

.static-board-editor-panel__error {
  margin: 0;
  color: #ff9c9c;
  word-break: break-word;
}
</style>
