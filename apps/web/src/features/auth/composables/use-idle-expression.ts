import { onBeforeUnmount, ref, watch, type Ref, type WatchSource } from 'vue';
import { IDLE_EXPRESSIONS, type EmblemExpression } from '../logic/emblem-mood';

const IDLE_AFTER_MS = 2000;
const CHANGE_EVERY_MS = 6000;

export function useIdleExpression(activity: WatchSource[], disabled: Ref<boolean>) {
  const expression = ref<EmblemExpression>('none');
  let timer: ReturnType<typeof setTimeout> | null = null;
  let next = 0;

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const show = () => {
    expression.value = IDLE_EXPRESSIONS[next % IDLE_EXPRESSIONS.length];
    next += 1;
    timer = setTimeout(show, CHANGE_EVERY_MS);
  };

  const restart = () => {
    clear();
    expression.value = 'none';
    if (disabled.value) return;
    timer = setTimeout(show, IDLE_AFTER_MS);
  };

  watch([...activity, disabled], restart, { immediate: true });
  onBeforeUnmount(clear);

  return expression;
}
