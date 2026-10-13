<template>
  <div class="help">
    <button
      type="button"
      class="help-btn"
      :aria-label="t('knowledge.help')"
      aria-describedby="knowledge-help-tip"
      data-testid="knowledge-help"
    >
      ?
    </button>
    <div id="knowledge-help-tip" class="help-tip" role="tooltip" data-testid="knowledge-help-tip">
      <b>{{ t('knowledge.title') }}</b>
      <span>{{ text }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{ text: string }>();
const { t } = useI18n();
</script>

<style scoped>
.help {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 5;
}
.help-btn {
  --face: linear-gradient(180deg, #3d4d5c, #2a3744);
  position: relative;
  isolation: isolate;
  width: 50px;
  height: 50px;
  padding: 0;
  border: 0;
  color: #f3e8d2;
  font-family: inherit;
  font-size: 1.7rem;
  font-weight: 700;
  cursor: help;
  background: linear-gradient(180deg, #7a8da0, #1b2630 60%, #46586a);
  clip-path: polygon(
    10px 0,
    calc(100% - 10px) 0,
    100% 10px,
    100% calc(100% - 10px),
    calc(100% - 10px) 100%,
    10px 100%,
    0 calc(100% - 10px),
    0 10px
  );
}
.help-btn::before {
  content: '';
  position: absolute;
  inset: 2px;
  z-index: -1;
  background: var(--face);
  clip-path: polygon(
    8px 0,
    calc(100% - 8px) 0,
    100% 8px,
    100% calc(100% - 8px),
    calc(100% - 8px) 100%,
    8px 100%,
    0 calc(100% - 8px),
    0 8px
  );
}
.help-btn:focus-visible {
  outline: 3px solid #f5c26b;
  outline-offset: 3px;
}
.help-tip {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 250px;
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(122, 141, 160, 0.7);
  background: rgba(14, 11, 9, 0.97);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.65);
  color: rgba(241, 228, 204, 0.95);
  font-size: 0.85rem;
  line-height: 1.4;
  text-align: left;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.12s ease,
    visibility 0.12s ease;
}
.help-tip b {
  color: #e8720c;
  font-variant: small-caps;
  letter-spacing: 0.03em;
}
.help:hover .help-tip,
.help-btn:focus-visible + .help-tip {
  opacity: 1;
  visibility: visible;
}
</style>
