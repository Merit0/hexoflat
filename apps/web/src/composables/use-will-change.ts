import { onBeforeUnmount, ref, watch, type Ref } from 'vue';

export const WILL_CHANGE_FLASH_MS = 1400;
export const WILL_GAIN_FLASH_MS = 700;

export interface WillChange {
  drop: Ref<number>;
  gained: Ref<boolean>;
}

export function useWillChange(current: () => number): WillChange {
  const drop = ref(0);
  const gained = ref(false);
  let dropTimer: number | null = null;
  let gainTimer: number | null = null;

  watch(current, (next, previous) => {
    if (next < previous) {
      drop.value = previous - next;
      if (dropTimer) window.clearTimeout(dropTimer);
      dropTimer = window.setTimeout(() => (drop.value = 0), WILL_CHANGE_FLASH_MS);
    }
    if (next > previous) {
      gained.value = true;
      if (gainTimer) window.clearTimeout(gainTimer);
      gainTimer = window.setTimeout(() => (gained.value = false), WILL_GAIN_FLASH_MS);
    }
  });

  onBeforeUnmount(() => {
    if (dropTimer) window.clearTimeout(dropTimer);
    if (gainTimer) window.clearTimeout(gainTimer);
  });

  return { drop, gained };
}
