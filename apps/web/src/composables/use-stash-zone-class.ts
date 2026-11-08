import { computed } from 'vue';
import { stashDrag } from './stash-drag-state';

/** A pane lights up green or red while the pointer is over it and not over one of its cells. */
export function useStashZoneClass(container: 'bag' | 'stash') {
  return computed(() => {
    const target = stashDrag.target;
    if (!stashDrag.active || target?.kind !== 'zone' || target.container !== container) return '';
    const preview = stashDrag.preview;
    if (!preview) return '';
    if (!preview.ok) return 'zone-bad';
    return preview.kind === 'noop' ? '' : 'zone-ok';
  });
}
