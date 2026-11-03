import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

export interface Ripple {
  id: number;
  x: number;
  y: number;
}

const MAX_RIPPLES = 6;
const LIFETIME_MS = 950;
const HALF_SIZE = 60;

export function useRipples(rootRef: Ref<HTMLElement | null>, disabled: Ref<boolean>) {
  const ripples = ref<Ripple[]>([]);
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let nextId = 0;

  const onDown = (event: PointerEvent) => {
    const root = rootRef.value;
    if (!root || disabled.value) return;
    if ((event.target as Element | null)?.closest?.('[data-auth-card]')) return;
    const rect = root.getBoundingClientRect();
    const id = ++nextId;
    ripples.value = [
      ...ripples.value,
      { id, x: event.clientX - rect.left - HALF_SIZE, y: event.clientY - rect.top - HALF_SIZE },
    ].slice(-MAX_RIPPLES);
    const timer = setTimeout(() => {
      timers.delete(timer);
      ripples.value = ripples.value.filter((ripple) => ripple.id !== id);
    }, LIFETIME_MS);
    timers.add(timer);
  };

  onMounted(() => rootRef.value?.addEventListener('pointerdown', onDown));
  onBeforeUnmount(() => {
    rootRef.value?.removeEventListener('pointerdown', onDown);
    timers.forEach(clearTimeout);
    timers.clear();
  });

  return ripples;
}
