<template>
  <aside class="wm-debug" data-testid="world-map-debug-panel">
    <header class="wm-debug__head">
      <span>world-map debug</span>
      <button type="button" class="wm-debug__collapse" @click="collapsed = !collapsed">
        {{ collapsed ? '▸' : '▾' }}
      </button>
    </header>

    <div v-if="!collapsed" class="wm-debug__body">
      <p v-if="!descriptor" class="wm-debug__hint">
        This location is not generated (only <code>silesia</code> is).
      </p>

      <template v-else>
        <div class="wm-debug__row">
          <code class="wm-debug__seed" data-testid="world-map-debug-seed">{{
            descriptor.seed
          }}</code>
          <button type="button" @click="copySeed">{{ copied ? 'copied' : 'copy' }}</button>
        </div>

        <div class="wm-debug__row">
          <span
            class="wm-debug__badge"
            :class="descriptor.validation.accepted ? 'ok' : 'bad'"
            data-testid="world-map-debug-verdict"
          >
            {{ descriptor.validation.accepted ? 'ACCEPTED' : 'FALLBACK' }}
          </span>
          <span>score {{ descriptor.validation.score }}/6</span>
          <span>{{ descriptor.attempts - 1 }} rejected</span>
        </div>

        <div class="wm-debug__row wm-debug__archetypes">
          <button
            v-for="key in archetypeKeys"
            :key="key"
            type="button"
            :class="{ active: key === descriptor.archetype }"
            :data-testid="`world-map-debug-archetype-${key}`"
            @click="worldStore.regenerateWorld(undefined, key)"
          >
            {{ key }}
          </button>
        </div>

        <div class="wm-debug__row">
          <button
            type="button"
            data-testid="world-map-debug-regenerate"
            @click="worldStore.regenerateWorld(descriptor.seed, descriptor.archetype)"
          >
            regenerate
          </button>
          <button
            type="button"
            data-testid="world-map-debug-next-seed"
            @click="worldStore.regenerateWorld()"
          >
            next seed
          </button>
        </div>

        <div class="wm-debug__row wm-debug__toggles">
          <label>
            <input
              v-model="showTechnicalGrid"
              type="checkbox"
              data-testid="world-map-debug-grid-toggle"
            />
            technical grid
          </label>
          <label>
            <input
              v-model="showGhostLayer"
              type="checkbox"
              data-testid="world-map-debug-ghost-toggle"
            />
            ghost layer
          </label>
        </div>

        <dl v-if="metrics" class="wm-debug__metrics">
          <div>
            <dt>hexes</dt>
            <dd>{{ metrics.hexCount }}</dd>
          </div>
          <div>
            <dt>branches</dt>
            <dd>{{ metrics.branchCount }}</dd>
          </div>
          <div>
            <dt>chokepoints</dt>
            <dd>{{ metrics.chokepointCount }}</dd>
          </div>
          <div>
            <dt>open-area</dt>
            <dd>{{ metrics.openAreaSize }}</dd>
          </div>
          <div>
            <dt>pocket</dt>
            <dd>{{ metrics.pocketSize }}</dd>
          </div>
          <div>
            <dt>promises</dt>
            <dd>{{ metrics.promiseCount }}</dd>
          </div>
          <div>
            <dt>centroid</dt>
            <dd>{{ metrics.symmetryOffset.toFixed(2) }}</dd>
          </div>
        </dl>

        <ul v-if="descriptor.validation.rejectionReasons.length" class="wm-debug__reasons">
          <li v-for="reason in descriptor.validation.rejectionReasons" :key="reason">
            {{ reason }}
          </li>
        </ul>
      </template>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { WORLD_ARCHETYPE_KEYS } from '@hexoflat/engine';
import { useWorldMapStore } from '@/stores/world-map-store';
import { debugShowGhostLayer, debugShowTechnicalGrid } from '@/services/world/world-map-debug';

const worldStore = useWorldMapStore();
const collapsed = ref(false);
const copied = ref(false);

const archetypeKeys = WORLD_ARCHETYPE_KEYS;
const showTechnicalGrid = debugShowTechnicalGrid;
const showGhostLayer = debugShowGhostLayer;

const descriptor = computed(() => worldStore.worldDescriptor);
const metrics = computed(() => descriptor.value?.validation.metrics ?? null);

async function copySeed() {
  const seed = descriptor.value?.seed;
  if (!seed) return;
  try {
    await navigator.clipboard.writeText(seed);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1200);
  } catch {
    copied.value = false;
  }
}
</script>

<style scoped>
.wm-debug {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 200;
  width: 260px;
  font:
    11px/1.4 ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  color: rgba(224, 240, 255, 0.92);
  background: rgba(8, 10, 14, 0.9);
  border: 1px solid rgba(143, 211, 255, 0.28);
  border-radius: 8px;
  backdrop-filter: blur(4px);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.5);
}

.wm-debug__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  border-bottom: 1px solid rgba(143, 211, 255, 0.18);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.8;
}

.wm-debug__collapse {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
}

.wm-debug__body {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wm-debug__row {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.wm-debug__seed {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 4px;
  border-radius: 4px;
}

.wm-debug button {
  background: rgba(143, 211, 255, 0.12);
  border: 1px solid rgba(143, 211, 255, 0.3);
  color: inherit;
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  font: inherit;
}

.wm-debug button.active {
  background: rgba(143, 211, 255, 0.4);
  color: #061018;
}

.wm-debug__archetypes {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.wm-debug__badge.ok {
  color: #7ad17a;
}

.wm-debug__badge.bad {
  color: #ffb07a;
}

.wm-debug__toggles {
  gap: 12px;
}

.wm-debug__toggles label {
  display: flex;
  gap: 4px;
  align-items: center;
  cursor: pointer;
}

.wm-debug__metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 10px;
  margin: 0;
}

.wm-debug__metrics div {
  display: flex;
  justify-content: space-between;
}

.wm-debug__metrics dt {
  opacity: 0.6;
}

.wm-debug__metrics dd {
  margin: 0;
}

.wm-debug__reasons {
  margin: 0;
  padding-left: 16px;
  color: #ffb07a;
}

.wm-debug__hint {
  margin: 0;
  opacity: 0.7;
}
</style>
