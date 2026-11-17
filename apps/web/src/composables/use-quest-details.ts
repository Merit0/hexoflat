import { computed, ref } from 'vue';

const CLOSE_DELAY_MS = 140;

const hoveredId = ref<string | null>(null);
const anchor = ref<DOMRect | null>(null);
let timer: number | null = null;

function cancelClose() {
  if (timer !== null) window.clearTimeout(timer);
  timer = null;
}

export function useQuestDetails() {
  return {
    openId: computed(() => hoveredId.value),
    anchor,
    hover(id: string, el: HTMLElement) {
      cancelClose();
      hoveredId.value = id;
      anchor.value = el.getBoundingClientRect();
    },
    leave() {
      cancelClose();
      timer = window.setTimeout(() => {
        hoveredId.value = null;
      }, CLOSE_DELAY_MS);
    },
    keepOpen: cancelClose,
    close() {
      cancelClose();
      hoveredId.value = null;
    },
  };
}
