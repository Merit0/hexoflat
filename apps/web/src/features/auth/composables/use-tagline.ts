import { onBeforeUnmount, onMounted, ref } from 'vue';

export function useTagline(count = 3, ms = 5000) {
  const index = ref(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  const start = () => {
    stop();
    timer = setInterval(() => {
      index.value = (index.value + 1) % count;
    }, ms);
  };

  const goTo = (next: number) => {
    index.value = next;
    start();
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

  return { index, goTo };
}
