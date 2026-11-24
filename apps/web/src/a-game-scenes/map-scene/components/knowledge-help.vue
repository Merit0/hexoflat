<template>
  <div class="help">
    <button
      type="button"
      class="board-icon-button help-btn"
      :aria-label="label ?? t('knowledge.help')"
      :aria-describedby="`${testid}-tip`"
      :data-testid="testid"
    >
      ?
    </button>
    <div :id="`${testid}-tip`" class="help-tip" role="tooltip" :data-testid="`${testid}-tip`">
      <b>{{ title ?? t('knowledge.title') }}</b>
      <span>{{ text }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

withDefaults(
  defineProps<{
    text: string;
    title?: string;
    label?: string;
    testid?: string;
  }>(),
  { title: undefined, label: undefined, testid: 'knowledge-help' },
);
const { t } = useI18n();
</script>

<style scoped src="../../../components/gui/board/board-icon-button.css"></style>
<style scoped>
.help {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 5;
}
.board-icon-button.help-btn {
  cursor: help;
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
  color: #ffe98a;
  font-variant: small-caps;
  letter-spacing: 0.04em;
  text-shadow:
    0 0 8px rgba(255, 233, 138, 0.4),
    0 1px 2px rgba(0, 0, 0, 0.8);
}
.help:hover .help-tip,
.help-btn:focus-visible + .help-tip {
  opacity: 1;
  visibility: visible;
}
</style>
