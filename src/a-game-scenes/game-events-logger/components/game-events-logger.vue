<template>
  <div ref="rootEl" class="game-events-logger" :class="{ open: isOpen }">
    <button class="logger-compact" type="button" @click="toggle" aria-haspopup="true" :aria-expanded="isOpen">
      <div v-if="lastTwo.length" class="compact-lines">
        <div v-for="e in lastTwo" :key="e.id" class="compact-line">
          <span class="hero-name">{{ e.actor ?? '' }}</span>
          <span class="msg">{{ e.message }}</span>
          <span class="time">- {{ e.time }}</span>
        </div>
      </div>

      <div v-else class="compact-empty">
        <span class="msg">No events</span>
      </div>
    </button>

    <transition name="logger-fade">
      <div v-if="isOpen" class="logger-dropdown" role="menu">
        <div class="dropdown-head">
          <div class="title">Events (last 50)</div>
          <button class="clear" type="button" @click="gameEventsStore.clear">Clear</button>
        </div>

        <div class="dropdown-list">
          <div v-if="!list.length" class="dropdown-empty">No events yet</div>

          <div v-else class="row" v-for="e in list" :key="e.id">
            <span class="hero-name">{{ e.actor ?? '' }}</span>
            <span class="row-msg">{{ e.message }}</span>
            <span class="row-time">{{ e.time }}</span>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {useGameEventsStore} from "@/stores/game-events-store";
import {useHeroStore} from "@/stores/hero-store";

const gameEventsStore = useGameEventsStore();

const isOpen = ref(false);
const rootEl = ref<HTMLElement | null>(null);

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatTime(ts: number) {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

const lastTwo = computed(() =>
    gameEventsStore.lastTwo.map(e => ({
      ...e,
      time: formatTime(e.createdAt),
    }))
);

const list = computed(() =>
    gameEventsStore.events.map(e => ({
      ...e,
      time: formatTime(e.createdAt),
    }))
);

function toggle() {
  isOpen.value = !isOpen.value;
}

function close() {
  isOpen.value = false;
}

function onDocClick(ev: MouseEvent) {
  if (!isOpen.value) return;
  const t = ev.target as Node | null;
  if (!t) return;
  if (rootEl.value && !rootEl.value.contains(t)) close();
}

function onKeyDown(ev: KeyboardEvent) {
  if (ev.key === "Escape") close();
}

onMounted(() => {
  document.addEventListener("click", onDocClick, true);
  document.addEventListener("keydown", onKeyDown);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onDocClick, true);
  document.removeEventListener("keydown", onKeyDown);
});
</script>

<style scoped>
.game-events-logger {
  position: relative;
  display: inline-block;
}

.logger-compact {
  width: 360px;
  height: 44px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 2px solid rgba(210, 235, 255, 0.7);
  background: rgba(10, 14, 18, 0.55);
  backdrop-filter: blur(6px);
  box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.06) inset,
      0 8px 22px rgba(0, 0, 0, 0.35);
  cursor: pointer;
  text-align: left;
  color: rgba(235, 245, 255, 0.92);
}

.compact-lines {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.compact-line {
  display: flex;
  gap: 6px;
  align-items: center;
  line-height: 1.05;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
}

.msg {
  overflow: hidden;
  text-overflow: ellipsis;
}

.time {
  flex: 0 0 auto;
  font: 12px monospace bold;
}

.compact-empty {
  font-size: 13px;
  opacity: 0.8;
}

/* dropdown */
.logger-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  width: 420px;
  border-radius: 12px;
  border: 1px solid rgba(210, 235, 255, 0.45);
  background: rgba(8, 10, 14, 0.78);
  backdrop-filter: blur(10px);
  box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.06) inset,
      0 18px 40px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  z-index: 999;
}

.dropdown-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(210, 235, 255, 0.15);
}

.title {
  font-size: 13px;
  opacity: 0.9;
}

.clear {
  border: 1px solid rgba(210, 235, 255, 0.25);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(235, 245, 255, 0.88);
  border-radius: 10px;
  padding: 6px 10px;
  cursor: pointer;
}
.clear:hover {
  border-color: rgba(210, 235, 255, 0.45);
  background: rgba(255, 255, 255, 0.08);
}

.dropdown-list {
  max-height: 360px;
  overflow: auto;
  padding: 8px 10px;
}

.dropdown-empty {
  padding: 14px 2px;
  opacity: 0.8;
  font-size: 13px;
}

.row {
  display: flex;
  gap: 10px;
  align-items: baseline;
  padding: 6px 2px;
  border-bottom: 1px dashed rgba(210, 235, 255, 0.10);
  font-size: 13px;
}
.row:last-child {
  border-bottom: none;
}

.row-msg {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-time {
  flex: 0 0 auto;
  opacity: 0.8;
}

/* transition */
.logger-fade-enter-active,
.logger-fade-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.logger-fade-enter-from,
.logger-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.hero-name {
  color: #f5d48e;
  text-shadow: 0 0 6px rgba(245, 212, 142, 0.45);
  font-weight: 700;
}
</style>