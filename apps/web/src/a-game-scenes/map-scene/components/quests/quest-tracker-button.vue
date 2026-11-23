<template>
  <div class="tracker" data-testid="quest-tracker">
    <button
      type="button"
      class="hex-btn"
      :class="{ 'is-open': open, 'is-spinning': spinning }"
      :aria-expanded="open"
      :aria-label="t('quest.tracker.open')"
      data-testid="quest-tracker-button"
      @click="toggle"
      @animationend="spinning = false"
    >
      <svg class="hex" viewBox="0 0 48 48" width="52" height="52" aria-hidden="true">
        <polygon class="hex-fill" points="24,2 43,13 43,35 24,46 5,35 5,13" />
        <g class="glyph" fill="#f5c26b" stroke="#f5c26b" stroke-linejoin="round">
          <path d="M21.500 12h5l-1 14.500h-3z" stroke-width="2" />
          <circle cx="24" cy="32.500" r="2.800" stroke="none" />
        </g>
      </svg>
      <span v-if="tracked.length > 0" class="badge" data-testid="quest-tracker-count">{{
        tracked.length
      }}</span>
    </button>
    <section v-if="open" class="info" data-testid="quest-tracker-info" @keydown.esc="open = false">
      <h3>{{ t('quest.board.group.active') }}</h3>
      <ul v-if="tracked.length > 0">
        <li
          v-for="entry in tracked"
          :key="entry.quest.id"
          :class="{ 'is-ready': entry.ready }"
          :data-testid="`quest-tracker-item-${entry.quest.id}`"
        >
          <span class="name">{{ t(entry.quest.nameKey, { target: entry.target }) }}</span>
          <span class="progress">
            <template v-if="entry.ready">{{ t('quest.tracker.ready') }}</template>
            <template v-else
              >{{ entry.progress }} / {{ entry.target }} {{ t(entry.unitKey) }}</template
            >
          </span>
        </li>
      </ul>
      <p v-else class="empty" data-testid="quest-tracker-info-empty">
        {{ t('quest.tracker.empty') }}
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuestView } from '@/composables/use-quest-view';

const { t } = useI18n();
const { tracked } = useQuestView();
const open = ref(false);
const spinning = ref(false);

function toggle() {
  open.value = !open.value;
  spinning.value = false;
  requestAnimationFrame(() => {
    spinning.value = true;
  });
}
</script>

<style scoped>
.tracker {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 20;
}
.hex-btn {
  position: relative;
  width: 52px;
  height: 52px;
  min-height: 52px;
  padding: 0;
  background: none;
  border: 0;
  cursor: pointer;
  filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.6));
}
.hex {
  display: block;
}
.hex-fill {
  fill: #1a2029;
  stroke: #d9a84e;
  stroke-width: 2;
  transition: fill 0.2s;
}
.hex-btn:hover,
.hex-btn:active,
.hex-btn:focus {
  background: none;
  box-shadow: none;
}
.hex-btn:hover .hex-fill {
  fill: #2a3744;
}
.hex-btn.is-open {
  filter: drop-shadow(0 0 7px rgba(245, 194, 107, 0.75)) drop-shadow(0 3px 5px rgba(0, 0, 0, 0.6));
}
.hex-btn.is-open .hex-fill {
  fill: #3a2f18;
  stroke: #ffe98a;
  stroke-width: 2.6;
}
.glyph {
  transition:
    fill 0.2s,
    stroke 0.2s;
  filter: drop-shadow(0 0 3px rgba(245, 194, 107, 0.55));
}
.hex-btn.is-open .glyph {
  fill: #ffe98a;
  stroke: #ffe98a;
}
.hex-btn:focus-visible {
  outline: 2px solid #ffe98a;
  outline-offset: 2px;
  border-radius: 12px;
}
.hex-btn.is-spinning .hex-fill {
  transform-box: fill-box;
  transform-origin: center;
  animation: tracker-spin 0.6s ease-out;
}
.badge {
  position: absolute;
  right: -4px;
  bottom: -4px;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  box-sizing: border-box;
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 20px;
  text-align: center;
  color: #fff;
  text-shadow: 0 1px 2px rgba(40, 10, 80, 0.7);
  background: radial-gradient(circle at 32% 28%, #b794f6, #7c3aed 55%, #5b21b6);
  border: 1.5px solid #e9ddff;
  border-radius: 999px;
  box-shadow:
    0 0 8px rgba(139, 92, 246, 0.7),
    0 2px 4px rgba(0, 0, 0, 0.5);
}
.info {
  position: absolute;
  top: 58px;
  left: 0;
  box-sizing: border-box;
  width: 260px;
  padding: 12px 14px;
  color: #efe3c8;
  background: linear-gradient(180deg, #17191c, #121416);
  border: 1px solid #d9a84e;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
  animation: tracker-pop 0.2s ease-out;
}
h3 {
  margin: 0 0 8px;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ffe98a;
}
ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  display: grid;
  gap: 2px;
}
.name {
  font-weight: 700;
}
.progress {
  font-size: 0.85rem;
  color: #cfc6b5;
  font-variant-numeric: tabular-nums;
}
li.is-ready .progress {
  color: #f5c26b;
}
.empty {
  margin: 0;
  font-size: 0.85rem;
  color: #cfc6b5;
}
@keyframes tracker-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(180deg);
  }
}
@keyframes tracker-pop {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .hex-btn.is-spinning .hex-fill,
  .info {
    animation: none;
  }
}
</style>
