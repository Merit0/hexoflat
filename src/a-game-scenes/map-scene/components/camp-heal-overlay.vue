<template>
  <div
      v-if="style"
      class="camp-heal-slot"
      :class="{ 'is-active': active, 'is-idle': !active }"
      :style="style"
  >
    <div class="camp-heal-slot__heart">♥</div>
    <div class="camp-heal-slot__label">{{ label }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  active: boolean;
  label: string;
  style: Record<string, string> | null;
}>();
</script>

<style scoped>
.camp-heal-slot {
  position: absolute;
  width: var(--hex-tile-width);
  height: var(--hex-tile-height);
  display: grid;
  place-items: center;
  z-index: 118;
  pointer-events: none;
}

.camp-heal-slot::before {
  content: "";
  position: absolute;
  inset: 0;
  clip-path: polygon(
      25% 0%,
      75% 0%,
      100% 50%,
      75% 100%,
      25% 100%,
      0% 50%
  );
  background: radial-gradient(circle at 50% 45%, rgba(132, 222, 156, 0.24), rgba(18, 68, 34, 0.82));
  box-shadow:
      0 0 0 1px rgba(148, 214, 166, 0.34),
      0 0 20px rgba(96, 168, 118, 0.22);
  animation: pulse-heart-bg 1.15s ease-in-out infinite;
}

.camp-heal-slot.is-idle::before {
  animation: none;
  opacity: 0.68;
  background: radial-gradient(circle at 50% 45%, rgba(166, 214, 178, 0.14), rgba(24, 38, 28, 0.82));
  box-shadow:
      0 0 0 1px rgba(148, 214, 166, 0.22),
      0 0 14px rgba(96, 168, 118, 0.08);
}

.camp-heal-slot__heart {
  position: relative;
  z-index: 1;
  font-size: calc(var(--hex-tile-width) * 0.544);
  line-height: 1;
  color: rgba(255, 96, 118, 0.96);
  text-shadow:
      0 0 12px rgba(255, 78, 108, 0.45),
      0 0 24px rgba(255, 78, 108, 0.22);
  animation: pulse-heart 1.15s ease-in-out infinite;
}

.camp-heal-slot.is-idle .camp-heal-slot__heart {
  animation: none;
  opacity: 0.78;
  color: rgba(228, 236, 244, 0.88);
  text-shadow: 0 0 10px rgba(180, 192, 208, 0.18);
}

.camp-heal-slot__label {
  position: absolute;
  left: 50%;
  bottom: 16%;
  z-index: 2;
  transform: translateX(-50%);
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(8, 14, 10, 0.72);
  border: 1px solid rgba(148, 214, 166, 0.22);
  color: rgba(236, 248, 239, 0.96);
  font-family: var(--font-main), serif;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.05em;
  white-space: nowrap;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}

.camp-heal-slot.is-idle .camp-heal-slot__label {
  background: rgba(20, 28, 24, 0.62);
  border-color: rgba(188, 200, 214, 0.18);
  color: rgba(220, 228, 238, 0.88);
}

@keyframes pulse-heart-bg {
  0%,
  100% {
    opacity: 0.78;
    transform: scale(0.98);
  }

  50% {
    opacity: 1;
    transform: scale(1.02);
  }
}

@keyframes pulse-heart {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.75;
  }

  50% {
    transform: scale(1.24);
    opacity: 1;
  }
}
</style>
