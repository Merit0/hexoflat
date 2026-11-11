const DRAG_THRESHOLD_PX = 4;
const EDGE_BAND_PX = 40;
const MAX_SCROLL_STEP_PX = 14;
const FX_MS = 320;
const GRABBING_CLASS = 'is-grabbing';

export interface DragPoint {
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export interface PointerDragHandlers {
  start: (point: DragPoint) => void;
  move: (x: number, y: number) => void;
  release: () => void;
  cancel: () => void;
}

export function setGrabbing(on: boolean): void {
  document.documentElement.classList.toggle(GRABBING_CLASS, on);
}

export function flashFor<K extends string>(
  fx: Record<K, string | null>,
  slot: K,
  key: string,
): void {
  fx[slot] = key;
  setTimeout(() => {
    if (fx[slot] === key) fx[slot] = null;
  }, FX_MS);
}

function edgeStep(rect: DOMRect, x: number, y: number): number {
  if (x < rect.left || x > rect.right) return 0;
  const fromTop = y - rect.top;
  const fromBottom = rect.bottom - y;
  let step = 0;
  if (fromTop >= 0 && fromTop < EDGE_BAND_PX) step = -Math.ceil((EDGE_BAND_PX - fromTop) / 4);
  else if (fromBottom >= 0 && fromBottom < EDGE_BAND_PX)
    step = Math.ceil((EDGE_BAND_PX - fromBottom) / 4);
  return Math.max(-MAX_SCROLL_STEP_PX, Math.min(MAX_SCROLL_STEP_PX, step));
}

export function startEdgeScroll(
  pointer: () => { x: number; y: number } | null,
  onScrolled: () => void,
): () => void {
  let frame: number | null = null;
  const tick = () => {
    const at = pointer();
    if (!at) {
      frame = null;
      return;
    }
    for (const box of document.querySelectorAll<HTMLElement>('[data-scroller]')) {
      const step = edgeStep(box.getBoundingClientRect(), at.x, at.y);
      if (step === 0) continue;
      box.scrollTop += step;
      onScrolled();
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  };
}

export function trackPointerDrag(event: PointerEvent, handlers: PointerDragHandlers): () => void {
  const startX = event.clientX;
  const startY = event.clientY;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  let started = false;

  const onMove = (move: PointerEvent) => {
    if (!started) {
      const far =
        Math.abs(move.clientX - startX) > DRAG_THRESHOLD_PX ||
        Math.abs(move.clientY - startY) > DRAG_THRESHOLD_PX;
      if (!far) return;
      started = true;
      handlers.start({
        x: startX,
        y: startY,
        offsetX: startX - rect.left,
        offsetY: startY - rect.top,
        width: rect.width,
        height: rect.height,
      });
    }
    handlers.move(move.clientX, move.clientY);
  };
  const onUp = () => {
    const wasDragging = started;
    detach();
    if (wasDragging) handlers.release();
  };
  const onCancel = () => {
    detach();
    if (started) handlers.cancel();
  };
  const onKey = (key: KeyboardEvent) => {
    if (key.key === 'Escape') onCancel();
  };
  const detach = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('keydown', onKey);
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  window.addEventListener('keydown', onKey);
  return detach;
}
