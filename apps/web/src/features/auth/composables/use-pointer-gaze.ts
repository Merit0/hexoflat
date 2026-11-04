import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { computeGaze, type GazePoint, type GazeRect } from '../logic/gaze';

const OFFSCREEN = -999;

export function usePointerGaze(
  rootRef: Ref<HTMLElement | null>,
  getEmblem: () => HTMLElement | null,
  disabled: Ref<boolean>,
) {
  const mx = ref(OFFSCREEN);
  const my = ref(OFFSCREEN);
  const gaze = ref<GazePoint>({ x: 0, y: 0 });

  let frame = 0;
  let pending: { mx: number; my: number; gaze: GazePoint } | null = null;
  let emblemRect: GazeRect | null = null;

  const measure = () => {
    const el = getEmblem();
    if (!el) {
      emblemRect = null;
      return;
    }
    const rect = el.getBoundingClientRect();
    emblemRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  };

  const flush = () => {
    frame = 0;
    if (!pending) return;
    mx.value = pending.mx;
    my.value = pending.my;
    gaze.value = pending.gaze;
    pending = null;
  };

  const onMove = (event: PointerEvent) => {
    const root = rootRef.value;
    if (!root || disabled.value || event.pointerType === 'touch') return;
    if (!emblemRect) measure();
    const rect = root.getBoundingClientRect();
    pending = {
      mx: event.clientX - rect.left,
      my: event.clientY - rect.top,
      gaze: emblemRect
        ? computeGaze({ x: event.clientX, y: event.clientY }, emblemRect)
        : { x: 0, y: 0 },
    };
    if (!frame) frame = requestAnimationFrame(flush);
  };

  const onLeave = () => {
    pending = null;
    mx.value = OFFSCREEN;
    my.value = OFFSCREEN;
    gaze.value = { x: 0, y: 0 };
  };

  onMounted(() => {
    const root = rootRef.value;
    root?.addEventListener('pointermove', onMove);
    root?.addEventListener('pointerleave', onLeave);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    measure();
  });

  onBeforeUnmount(() => {
    const root = rootRef.value;
    root?.removeEventListener('pointermove', onMove);
    root?.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('resize', measure);
    window.removeEventListener('scroll', measure, true);
    if (frame) cancelAnimationFrame(frame);
  });

  return { mx, my, gaze };
}
