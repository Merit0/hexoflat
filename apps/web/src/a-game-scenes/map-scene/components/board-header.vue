<template>
  <div class="board-head">
    <header class="board-header">
      <knowledge-help
        :testid="helpTestid"
        :title="helpTitle ?? title"
        :label="helpLabel ?? title"
        :text="helpText"
      />
      <h2>{{ title }}</h2>
      <board-close-button :testid="closeTestid" :label="closeLabel" @close="emit('close')" />
    </header>
    <div class="ornament" aria-hidden="true"><span></span><i></i><span></span></div>
  </div>
</template>

<script setup lang="ts">
import BoardCloseButton from '@/components/gui/board/board-close-button.vue';
import KnowledgeHelp from './knowledge-help.vue';

defineProps<{
  title: string;
  helpText: string;
  helpTestid: string;
  closeTestid: string;
  closeLabel: string;
  helpTitle?: string;
  helpLabel?: string;
}>();
const emit = defineEmits<{ close: [] }>();
</script>

<style scoped>
.board-head {
  flex: none;
}
.board-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-height: 70px;
  padding: 0 70px;
}
h2 {
  margin: 0;
  font-family: var(--font-main, serif), serif;
  font-size: 1.6rem;
  font-weight: 700;
  font-variant: small-caps;
  letter-spacing: 0.05em;
  text-align: center;
  color: #ffe98a;
  text-shadow:
    0 0 12px rgba(255, 233, 138, 0.4),
    0 2px 3px rgba(0, 0, 0, 0.8);
}
.ornament {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
}
.ornament span {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.22), transparent);
}
.ornament i {
  width: 9px;
  height: 9px;
  border: 1px solid rgba(255, 220, 150, 0.55);
  transform: rotate(45deg);
}
</style>
