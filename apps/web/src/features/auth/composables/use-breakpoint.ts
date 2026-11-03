import { ref, type Ref } from 'vue';

export type AuthBreakpoint = 'phone' | 'wide';

const PHONE_QUERY = '(max-width: 599.98px)';

let shared: Ref<AuthBreakpoint> | null = null;

function createShared(): Ref<AuthBreakpoint> {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return ref<AuthBreakpoint>('wide');
  }
  const query = window.matchMedia(PHONE_QUERY);
  const current = ref<AuthBreakpoint>(query.matches ? 'phone' : 'wide');
  query.addEventListener('change', (event) => {
    current.value = event.matches ? 'phone' : 'wide';
  });
  return current;
}

export function useBreakpoint(): Ref<AuthBreakpoint> {
  shared ??= createShared();
  return shared;
}
