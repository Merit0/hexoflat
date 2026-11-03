import { computed, type Ref } from 'vue';
import { deriveEmblemMood } from '../logic/emblem-mood';
import { useAuthForm } from './use-auth-form';
import { useIdleExpression } from './use-idle-expression';
import { useBlink } from './use-blink';
import { usePointerGaze } from './use-pointer-gaze';
import { usePrefersReducedMotion } from './use-prefers-reduced-motion';
import { useRipples } from './use-ripples';

export function useAuthStage(
  rootRef: Ref<HTMLElement | null>,
  getEmblem: () => HTMLElement | null,
) {
  const form = useAuthForm();
  const reduced = usePrefersReducedMotion();
  const blink = useBlink();
  const { mx, my, gaze } = usePointerGaze(rootRef, getEmblem, reduced);
  const ripples = useRipples(rootRef, reduced);

  const expression = useIdleExpression(
    [
      mx,
      my,
      () => form.focus,
      () => form.loading,
      () => form.mode,
      () => form.user,
      () => form.newName,
    ],
    reduced,
  );

  const mood = computed(() =>
    deriveEmblemMood({
      focus: form.focus,
      show: form.show,
      blink: blink.value,
      loading: form.loading,
      expression: expression.value,
      gaze: reduced.value ? { x: 0, y: 0 } : gaze.value,
      nameLength: form.focus === 'newName' ? form.newName.length : form.user.length,
    }),
  );

  return { mx, my, ripples, mood };
}
