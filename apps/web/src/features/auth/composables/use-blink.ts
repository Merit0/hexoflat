import { onBeforeUnmount, onMounted, ref } from 'vue';

const BLINK_EVERY_MS = 4300;
const BLINK_FOR_MS = 140;

export function useBlink() {
  const blink = ref(false);
  let interval: ReturnType<typeof setInterval> | null = null;
  let off: ReturnType<typeof setTimeout> | null = null;

  const stop = () => {
    if (interval) clearInterval(interval);
    if (off) clearTimeout(off);
    interval = null;
    off = null;
    blink.value = false;
  };

  const start = () => {
    stop();
    interval = setInterval(() => {
      blink.value = true;
      off = setTimeout(() => {
        blink.value = false;
      }, BLINK_FOR_MS);
    }, BLINK_EVERY_MS);
  };

  const onVisibility = () => (document.hidden ? stop() : start());

  onMounted(() => {
    start();
    document.addEventListener('visibilitychange', onVisibility);
  });
  onBeforeUnmount(() => {
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
  });

  return blink;
}
