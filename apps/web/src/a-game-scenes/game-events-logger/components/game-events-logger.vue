<template>
  <div class="game-events-logger" data-testid="events-logger">
    <div class="logger-head">
      <div class="title">Events (last 50)</div>
      <button
        class="clear"
        data-testid="events-logger-clear-button"
        type="button"
        @click="gameEventsStore.clear"
      >
        Clear
      </button>
    </div>

    <div class="logger-list">
      <div v-if="!list.length" class="logger-empty">No events yet</div>

      <div
        v-for="e in list"
        v-else
        :key="e.id"
        class="row"
        :data-testid="`events-logger-row-${e.id}`"
      >
        <span class="hero-name">{{ e.actor ?? '' }}</span>
        <span class="row-msg">
          <template
            v-for="(segment, index) in parseMessageSegments(e.message)"
            :key="`${e.id}-row-${index}`"
          >
            <span v-if="segment.kind === 'damage'" class="number-damage">{{ segment.text }}</span>
            <span v-else>{{ segment.text }}</span>
          </template>
        </span>
        <span class="row-time">{{ e.time }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameEventsStore } from '@/stores/game-events-store';

const gameEventsStore = useGameEventsStore();

function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function formatTime(ts: number) {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

const list = computed(() =>
  gameEventsStore.events.map((e) => ({
    ...e,
    time: formatTime(e.createdAt),
  })),
);

type MessageSegment = { kind: 'text'; text: string } | { kind: 'damage'; text: string };

function parseMessageSegments(message: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  const regex = /\[dmg:([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(message))) {
    const [fullMatch, damageValue] = match;
    const index = match.index;

    if (index > lastIndex) {
      segments.push({ kind: 'text', text: message.slice(lastIndex, index) });
    }

    segments.push({ kind: 'damage', text: damageValue });
    lastIndex = index + fullMatch.length;
  }

  if (lastIndex < message.length) {
    segments.push({ kind: 'text', text: message.slice(lastIndex) });
  }

  return segments.length ? segments : [{ kind: 'text', text: message }];
}
</script>

<style scoped>
.game-events-logger {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.logger-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(210, 235, 255, 0.25);
  background: rgba(10, 14, 18, 0.55);
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

.logger-list {
  width: 100%;
  border-radius: 12px;
  border: 1px solid rgba(210, 235, 255, 0.18);
  background: rgba(8, 10, 14, 0.55);
  padding: 8px 12px;
}

.logger-empty {
  padding: 14px 2px;
  opacity: 0.8;
  font-size: 13px;
}

.row {
  display: flex;
  gap: 10px;
  align-items: baseline;
  padding: 8px 2px;
  border-bottom: 1px dashed rgba(210, 235, 255, 0.1);
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

.hero-name {
  color: #f5d48e;
  text-shadow: 0 0 6px rgba(245, 212, 142, 0.45);
  font-weight: 700;
}
</style>
