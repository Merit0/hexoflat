import { onBeforeUnmount, onMounted, ref } from 'vue';

export function usePrefersReducedMotion() {
  const reduced = ref(false);
  let query: MediaQueryList | null = null;

  const sync = () => {
    reduced.value = !!query?.matches;
  };

  onMounted(() => {
    query = window.matchMedia('(prefers-reduced-motion: reduce)');
    sync();
    query.addEventListener('change', sync);
  });
  onBeforeUnmount(() => query?.removeEventListener('change', sync));

  return reduced;
}
