import { computed, ref } from 'vue';

const CLOSE_DELAY_MS = 140;

const hoveredId = ref<string | null>(null);
const pinnedId = ref<string | null>(null);
const anchor = ref<DOMRect | null>(null);
let anchorEl: HTMLElement | null = null;
let timer: number | null = null;

function cancelClose() {
  if (timer !== null) window.clearTimeout(timer);
  timer = null;
}

function measure(el: HTMLElement) {
  anchorEl = el;
  anchor.value = el.getBoundingClientRect();
}

export function useQuestDetails() {
  return {
    openId: computed(() => pinnedId.value ?? hoveredId.value),
    pinned: computed(() => pinnedId.value !== null),
    anchor,
    hover(id: string, el: HTMLElement) {
      cancelClose();
      hoveredId.value = id;
      if (pinnedId.value === null) measure(el);
    },
    leave() {
      cancelClose();
      timer = window.setTimeout(() => {
        hoveredId.value = null;
      }, CLOSE_DELAY_MS);
    },
    keepOpen: cancelClose,
    toggle(id: string, el: HTMLElement) {
      cancelClose();
      if (pinnedId.value === id) {
        pinnedId.value = null;
        return;
      }
      pinnedId.value = id;
      hoveredId.value = id;
      measure(el);
    },
    close() {
      cancelClose();
      pinnedId.value = null;
      hoveredId.value = null;
    },
    closeAndFocusRow() {
      anchorEl?.focus();
      cancelClose();
      pinnedId.value = null;
      hoveredId.value = null;
    },
  };
}
