import { reactive } from 'vue';
import { setGrabbing } from '@/composables/board-drag-core';

const THRESHOLD_PX = 4;
const GROUP_ATTR = 'data-quest-group';

export type QuestGroup = 'active' | 'available';

export interface QuestDragState {
  active: boolean;
  questId: string | null;
  label: string;
  from: QuestGroup | null;
  over: QuestGroup | null;
  x: number;
  y: number;
}

export const questDrag = reactive<QuestDragState>({
  active: false,
  questId: null,
  label: '',
  from: null,
  over: null,
  x: 0,
  y: 0,
});

let suppressClick = false;

export function consumeQuestDragClick(): boolean {
  const was = suppressClick;
  suppressClick = false;
  return was;
}

export function targetOf(from: QuestGroup): QuestGroup {
  return from === 'available' ? 'active' : 'available';
}

function groupAt(x: number, y: number): QuestGroup | null {
  const hit = document.elementFromPoint(x, y)?.closest(`[${GROUP_ATTR}]`);
  const value = hit?.getAttribute(GROUP_ATTR);
  return value === 'active' || value === 'available' ? value : null;
}

function reset() {
  questDrag.active = false;
  questDrag.questId = null;
  questDrag.from = null;
  questDrag.over = null;
  setGrabbing(false);
}

export interface QuestDragSource {
  questId: string;
  label: string;
  from: QuestGroup;
  onDrop: (target: QuestGroup) => void;
}

export function beginQuestPress(event: PointerEvent, source: QuestDragSource): void {
  if (event.button !== 0) return;
  const startX = event.clientX;
  const startY = event.clientY;
  let dragging = false;

  const move = (next: PointerEvent) => {
    if (!dragging) {
      if (Math.hypot(next.clientX - startX, next.clientY - startY) < THRESHOLD_PX) return;
      dragging = true;
      questDrag.active = true;
      questDrag.questId = source.questId;
      questDrag.label = source.label;
      questDrag.from = source.from;
      setGrabbing(true);
    }
    questDrag.x = next.clientX;
    questDrag.y = next.clientY;
    questDrag.over = groupAt(next.clientX, next.clientY);
  };

  const finish = (apply: boolean) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('keydown', key);
    if (!dragging) return;
    suppressClick = true;
    setTimeout(() => {
      suppressClick = false;
    }, 0);
    const over = questDrag.over;
    reset();
    if (apply && over && over !== source.from) source.onDrop(over);
  };
  const up = () => finish(true);
  const cancel = () => finish(false);
  const key = (next: KeyboardEvent) => {
    if (next.key === 'Escape') finish(false);
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('keydown', key);
}
