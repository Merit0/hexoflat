<template>
  <div class="tool-hex-tile" :class="{ doing: working }">
    <div class="tool-icon" :class="{ flipped }" :style="iconStyle"></div>
    <div v-if="!working" class="tool-actions-row">
      <button
        v-if="label"
        class="do-btn"
        :class="{ 'is-denied': denied }"
        data-testid="tool-action-button"
        :aria-label="label"
        :aria-disabled="!canAfford"
        @click.stop="emit('act')"
      >
        <eye-icon v-if="read" class="eye-icon" />
        <template v-else>{{ label }}</template>
      </button>
      <button v-else class="hide-btn" data-testid="tool-hide-button" @click.stop="emit('hide')">
        -
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import EyeIcon from '@/components/gui/icons/eye-icon.vue';

const props = defineProps<{
  iconPath: string;
  flipped: boolean;
  working: boolean;
  label: string | null;
  read: boolean;
  denied: boolean;
  canAfford: boolean;
}>();

const emit = defineEmits<{
  (e: 'act'): void;
  (e: 'hide'): void;
}>();

const iconStyle = computed(() => ({ backgroundImage: `url(${props.iconPath})` }));
</script>

<style scoped>
.tool-hex-tile {
  position: absolute;
  width: var(--hex-tile-width);
  height: var(--hex-tile-height);

  clip-path: var(--hex-clip-path);

  z-index: 120;
  pointer-events: auto;

  background-image: url('/hex-assets/hex-tools/tool-frame-hex.png');
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;

  filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.5));
}

.tool-icon {
  position: absolute;
  inset: 0;

  background-size: 100%;
  background-repeat: no-repeat;
  background-position: center;

  pointer-events: none;
}

.tool-icon.flipped {
  transform: scaleX(-1);
}

.hide-btn {
  width: 18px;
  min-width: 18px;
  height: 18px;
  padding: 0;
  border-radius: 999px;

  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(0, 0, 0, 0.55);
  color: #f2e9d3;

  font-weight: 900;
  font-size: 9px;
  line-height: 1;
  letter-spacing: 0;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.24);

  transition:
    transform 120ms ease,
    background 120ms ease,
    filter 120ms ease;
}

.hide-btn:hover {
  filter: brightness(1.15);
  background: rgba(0, 0, 0, 0.7);
}

.hide-btn:active {
  transform: scale(0.96);
}

.do-btn {
  position: relative;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(0, 0, 0, 0.55);
  color: #e9f7ff;
  font-weight: 900;
  font-size: 12px;
  line-height: 1;
  letter-spacing: 0.12em;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.28);
  transition:
    background 90ms ease,
    border-color 90ms ease;
}

.do-btn.is-denied {
  border-color: rgba(255, 150, 150, 0.45);
  background: rgba(190, 70, 70, 0.5);
}

.eye-icon {
  display: block;
  width: 20px;
  height: 20px;
}

.do-btn:hover {
  color: #e9f7ff;
  border-color: rgba(255, 255, 255, 0.22);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.28);
}

.do-btn:active {
  transform: scale(0.98);
}

.tool-actions-row {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: calc(var(--hex-tile-width) * 0.72);
  max-width: calc(var(--hex-tile-width) * 0.72);
  z-index: 2;
  pointer-events: auto;
}

.tool-hex-tile.doing {
  background-image: none;
  animation: tool-chop 220ms ease-in-out infinite;
  scale: 0.7;
}

@keyframes tool-chop {
  0% {
    transform: rotate(-6deg) scale(1.02);
  }
  50% {
    transform: rotate(7deg) scale(1.04);
  }
  100% {
    transform: rotate(-6deg) scale(1.02);
  }
}
</style>
